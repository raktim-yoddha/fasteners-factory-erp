import type {
  Authority,
  AdministrationRequest,
  AdministrationResult,
  CommandName,
  CommandPayload,
  CommandRequest,
  CommandResult,
  Repository,
  MemberAccess,
} from '@fasteners/contracts';
export { capability } from './capabilities';
export {
  AdministrationController,
  type AdministrationStore,
  type AdministrationCommit,
} from './administration';
export type { DurableRequestStore } from './durable-request';
export type { MemberAccess } from '@fasteners/contracts';
export {
  CompanySetupController,
  type CompanySetupStore,
  type CompanySetupCommit,
} from './company-setup';
export { recordOptions, orderLabel } from './operational-reads';
export type { SnapshotRecoveryPort, RecoveryJournal } from './recovery';
export type SaveState = 'idle' | 'submitting' | 'committed' | 'unsent' | 'unknown' | 'failed';
export interface PendingCommandStore {
  read(actor: string, authority: Authority): CommandRequest | null;
  save(actor: string, command: CommandRequest): void;
  clear(actor: string, authority: Authority): void;
}
export class CommandController {
  private pending = new Map<string, CommandRequest>();
  constructor(private readonly repository: Repository) {}
  async submit(request: CommandRequest): Promise<CommandResult> {
    this.pending.set(request.idempotencyKey, request);
    const result = await this.repository.execute(request);
    if (result.ok || result.error.code !== 'CONFIRMATION_UNKNOWN')
      this.pending.delete(request.idempotencyKey);
    return result;
  }
  unresolved(): CommandRequest[] {
    return [...this.pending.values()];
  }
  discard(): void {
    this.pending.clear();
  }
}
export function request<K extends CommandName>(
  authority: Authority,
  command: K,
  payload: CommandPayload<K>,
  expectedRevision?: string,
): Extract<CommandRequest, { command: K }> {
  return {
    contractVersion: 1,
    authority,
    command,
    payload,
    idempotencyKey: crypto.randomUUID(),
    ...(expectedRevision ? { expectedRevision } : {}),
  } as Extract<CommandRequest, { command: K }>;
}
export interface TeamAuthPort {
  currentUser(): Promise<{ id: string; email: string; verified: boolean } | null>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  recover(email: string): Promise<void>;
  signOut(): Promise<void>;
  createCompany(
    input: {
      name: string;
      plantName: string;
      warehouseName: string;
      currency: string;
      timezone: string;
    },
    key: string,
    expectedActorId: string,
  ): Promise<string>;
  acceptInvitation(token: string): Promise<void>;
  changePassword(password: string): Promise<void>;
  enrollMfa(): Promise<{ id: string; qrCode: string; secret: string }>;
  verifyMfa(factorId: string, code: string): Promise<void>;
  mfaFactors(): Promise<{ id: string; name: string }[]>;
}
export interface TeamAdministrationSnapshot {
  actorId: string;
  members: MemberAccess[];
  plants: { id: string; name: string }[];
  roles: { name: string; delegable: boolean; permissions: string[] }[];
  settings: { independentReview: boolean; requireMfa: boolean; state: string };
}
export interface TeamAdministrationPort {
  snapshot(companyId: string): Promise<TeamAdministrationSnapshot>;
  execute(request: AdministrationRequest): Promise<AdministrationResult>;
  manage(
    companyId: string,
    action:
      'request_transfer' | 'accept_transfer' | 'archive' | 'independent_review' | 'require_mfa',
    input: { target?: string; enabled?: boolean },
  ): Promise<void>;
}
