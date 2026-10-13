import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './generated/database';
export type CloudClient = SupabaseClient<Database>;
export { CloudAdministration } from './administration';
import { checkRpcConfirmation, verifiedToken } from './rpc-confirmation';
import {
  DomainError,
  authorityKey,
  parseCommand,
  workspaceSchema,
  snapshotSchema,
  commandResultSchema,
  companySetupInputSchema,
  identifierSchema,
  type Authority,
  type CommandRequest,
  type CommandResult,
  type CreateWorkspace,
  type Repository,
  type Snapshot,
  type Workspace,
} from '@fasteners/contracts';
import type { TeamAuthPort } from '@fasteners/application';
export interface AuthStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}
function online(): boolean {
  return (
    typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' || navigator.onLine
  );
}
function requireOnline(): void {
  if (!online())
    throw new DomainError(
      'OFFLINE_TEAM_WRITE_BLOCKED',
      'Team is offline. No critical request was sent.',
    );
}
export function createCloudClient(url: string, key: string, storage?: AuthStorage): CloudClient {
  return createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      detectSessionInUrl: true,
      storageKey: 'fasteners-cloud-auth',
      ...(storage ? { storage } : {}),
    },
  });
}
export class CloudAuth implements TeamAuthPort {
  constructor(private readonly client: CloudClient) {}
  async currentUser() {
    const { data: session } = await this.client.auth.getSession();
    if (!session.session) return null;
    const { data, error } = await this.client.auth.getUser();
    if (error)
      throw new DomainError('AUTH_REQUIRED', 'Current authentication could not be verified.');
    return data.user
      ? {
          id: data.user.id,
          email: data.user.email ?? '',
          verified: Boolean(data.user.email_confirmed_at),
        }
      : null;
  }
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }
  async signUp(email: string, password: string): Promise<void> {
    requireOnline();
    const { error } = await this.client.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  }
  async recover(email: string): Promise<void> {
    requireOnline();
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  }
  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(error.message);
  }
  async createCompany(
    input: {
      name: string;
      plantName: string;
      warehouseName: string;
      currency: string;
      timezone: string;
    },
    key: string,
    expectedActorId: string,
  ): Promise<string> {
    requireOnline();
    if (
      !companySetupInputSchema.safeParse(input).success ||
      !identifierSchema.safeParse(key).success
    )
      throw new DomainError('INVALID_INPUT', 'Check the company setup fields and request key.');
    const token = await verifiedToken(this.client, expectedActorId);
    try {
      // Capture the verified token so a concurrent session switch cannot change the request actor.
      const response = await this.client
        .rpc('create_company', { input, request_key: key })
        .setHeader('Authorization', `Bearer ${token}`);
      checkRpcConfirmation(response, 'Company setup');
      return identifierSchema.parse(response.data);
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      throw new DomainError(
        'CONFIRMATION_UNKNOWN',
        'Company confirmation unknown. Preserve the original request key.',
      );
    }
  }
  async acceptInvitation(token: string): Promise<void> {
    requireOnline();
    const { error } = await this.client.rpc('accept_invitation', { token });
    if (error) throw new Error(error.message);
  }
  async changePassword(password: string): Promise<void> {
    requireOnline();
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }
  async enrollMfa() {
    requireOnline();
    const { data, error } = await this.client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Factory ERP authenticator',
    });
    if (error) throw new Error(error.message);
    return { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }
  async verifyMfa(factorId: string, code: string): Promise<void> {
    requireOnline();
    const { error } = await this.client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw new Error(error.message);
  }
  async mfaFactors() {
    const { data, error } = await this.client.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    return data.totp
      .filter((factor) => factor.status === 'verified')
      .map((factor) => ({ id: factor.id, name: factor.friendly_name ?? 'Authenticator' }));
  }
}
export class CloudRepository implements Repository {
  constructor(
    private readonly client: CloudClient,
    private readonly connected: () => boolean = online,
  ) {}
  async listWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await this.client.rpc('list_workspaces');
    if (error) throw new DomainError('AUTH_REQUIRED', 'Company memberships could not be read.');
    return workspaceSchema.array().parse(data);
  }
  async createWorkspace(_input: CreateWorkspace): Promise<Workspace> {
    throw new DomainError('INVALID_INPUT', 'Use the verified company creation flow for Team mode.');
  }
  async snapshot(authority: Authority): Promise<Snapshot> {
    if (authority.kind !== 'team')
      throw new DomainError('COMPANY_SCOPE_MISMATCH', 'Supabase cannot read a solo workspace.');
    const { data, error } = await this.client.rpc('workspace_snapshot', { authority });
    if (error)
      throw new DomainError(
        'PERMISSION_DENIED',
        'Current company records are unavailable or permission was revoked.',
      );
    const snapshot = snapshotSchema.parse(data);
    if (
      snapshot.workspace.id !== authority.companyId ||
      (authority.plantId && snapshot.plantId !== authority.plantId)
    )
      throw new DomainError(
        'COMPANY_SCOPE_MISMATCH',
        'Backend read did not match the selected company and plant.',
      );
    return snapshot;
  }
  async execute(input: CommandRequest): Promise<CommandResult> {
    const request = parseCommand(input);
    if (!this.connected())
      return {
        ok: false,
        error: {
          code: 'OFFLINE_TEAM_WRITE_BLOCKED',
          message:
            'Team is offline. No command was sent. Critical writes require the online authority.',
          retryable: true,
          correlationId: request.idempotencyKey,
        },
      };
    if (request.authority.kind !== 'team')
      return {
        ok: false,
        error: {
          code: 'COMPANY_SCOPE_MISMATCH',
          message: 'Supabase cannot write a solo workspace.',
          retryable: false,
          correlationId: request.idempotencyKey,
        },
      };
    try {
      const { data, error } = await this.client.rpc('execute_command', { request });
      if (error) {
        const transport = error.code === '' || /fetch|network|timeout/i.test(error.message);
        return {
          ok: false,
          error: {
            code: transport ? 'CONFIRMATION_UNKNOWN' : 'PERMISSION_DENIED',
            message: transport
              ? 'Server confirmation unknown. Retry the original request key.'
              : 'Server rejected this action under current authorization.',
            retryable: transport,
            correlationId: request.idempotencyKey,
          },
        };
      }
      const result = commandResultSchema.parse(data);
      if (result.ok && authorityKey(result.authority) !== authorityKey(request.authority))
        throw new Error('Response authority mismatch.');
      return result;
    } catch {
      return {
        ok: false,
        error: {
          code: 'CONFIRMATION_UNKNOWN',
          message: 'Server confirmation unknown. Retry the original request key.',
          retryable: true,
          correlationId: request.idempotencyKey,
        },
      };
    }
  }
  async close(): Promise<void> {
    await this.client.removeAllChannels();
  }
}
