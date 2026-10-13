import type {
  Authority,
  CommandName,
  CommandPayload,
  CommandRequest,
  CommandResult,
  Repository,
} from '@fasteners/contracts';
export { capability } from './capabilities';
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
  ): Promise<void>;
  acceptInvitation(token: string): Promise<void>;
  changePassword(password: string): Promise<void>;
  enrollMfa(): Promise<{ id: string; qrCode: string; secret: string }>;
  verifyMfa(factorId: string, code: string): Promise<void>;
  mfaFactors(): Promise<{ id: string; name: string }[]>;
}
export interface MemberAccess {
  id: string;
  email: string;
  active: boolean;
  allPlants: boolean;
  roles: string[];
  plantIds: string[];
  grants: string[];
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
  invite(
    companyId: string,
    input: { email: string; roles: string[]; plantIds: string[]; allPlants: boolean },
    requestKey: string,
  ): Promise<{ id: string; token: string }>;
  updateAccess(companyId: string, input: MemberAccess, requestKey: string): Promise<void>;
  createPlant(
    companyId: string,
    input: { name: string; warehouseName: string },
    requestKey: string,
  ): Promise<void>;
  manage(
    companyId: string,
    action:
      'request_transfer' | 'accept_transfer' | 'archive' | 'independent_review' | 'require_mfa',
    input: { target?: string; enabled?: boolean },
  ): Promise<void>;
}
