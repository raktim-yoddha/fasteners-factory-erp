import {
  companySetupInputSchema,
  companySetupRequestSchema,
  DomainError,
  identifierSchema,
  type CompanySetupInput,
  type CompanySetupRequest,
} from '@fasteners/contracts';
import type { TeamAuthPort } from './index';

export interface CompanySetupStore {
  read(actorId: string): CompanySetupRequest | null;
  save(request: CompanySetupRequest): void;
  clear(request: CompanySetupRequest): void;
  exclusive<T>(actorId: string, operation: () => Promise<T>): Promise<T>;
}
export interface CompanySetupCommit {
  companyId: string;
  journalCleared: boolean;
}

export class CompanySetupController {
  constructor(
    private readonly auth: TeamAuthPort,
    private readonly store: CompanySetupStore,
  ) {}

  read(actorId: string): CompanySetupRequest | null {
    return this.store.read(actorId);
  }
  async submit(actorId: string, input: CompanySetupInput): Promise<CompanySetupCommit> {
    const validated = companySetupInputSchema.safeParse(input);
    if (!validated.success)
      throw new DomainError('INVALID_INPUT', 'Check the company setup fields.');
    return this.store.exclusive(actorId, async () => {
      if (this.read(actorId))
        throw new DomainError(
          'CONFIRMATION_UNKNOWN',
          'Resolve the original company request first.',
        );
      return this.dispatch(
        { contractVersion: 1, actorId, requestKey: crypto.randomUUID(), input: validated.data },
        false,
      );
    });
  }
  async retry(actorId: string): Promise<CompanySetupCommit> {
    return this.store.exclusive(actorId, async () => {
      const original = this.read(actorId);
      if (!original) throw new DomainError('INVALID_INPUT', 'No original company request exists.');
      return this.dispatch(original, true);
    });
  }
  private async dispatch(
    request: CompanySetupRequest,
    previouslyUncertain: boolean,
  ): Promise<CompanySetupCommit> {
    companySetupRequestSchema.parse(request);
    const current = await this.auth.currentUser();
    if (!current?.verified || current.id !== request.actorId)
      throw new DomainError(
        'AUTH_REQUIRED',
        'Sign in with the original verified account before sending company setup.',
      );
    this.store.save(request);
    let companyId: string;
    try {
      companyId = identifierSchema.parse(
        await this.auth.createCompany(request.input, request.requestKey, request.actorId),
      );
    } catch (cause) {
      if (
        !previouslyUncertain &&
        cause instanceof DomainError &&
        [
          'INVALID_INPUT',
          'AUTH_REQUIRED',
          'IDEMPOTENCY_KEY_REUSED',
          'OFFLINE_TEAM_WRITE_BLOCKED',
        ].includes(cause.code)
      ) {
        this.store.clear(request);
        throw cause;
      }
      throw new DomainError(
        'CONFIRMATION_UNKNOWN',
        'Company confirmation unknown. Retry the retained original request with the same account.',
      );
    }
    try {
      this.store.clear(request);
      return { companyId, journalCleared: true };
    } catch {
      // The authority committed even if local cleanup failed. A retry only replays that commit.
      return { companyId, journalCleared: false };
    }
  }
}
