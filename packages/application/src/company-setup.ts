import {
  companySetupInputSchema,
  companySetupRequestSchema,
  DomainError,
  identifierSchema,
  type CompanySetupInput,
  type CompanySetupRequest,
} from '@fasteners/contracts';
import type { TeamAuthPort } from './index';
import {
  confirmDurableRequest,
  requireVerifiedActor,
  type DurableRequestStore,
} from './durable-request';

export type CompanySetupStore = DurableRequestStore<CompanySetupRequest>;
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
    await requireVerifiedActor(this.auth, request.actorId);
    const result = await confirmDurableRequest(
      request,
      this.store,
      async () =>
        identifierSchema.parse(
          await this.auth.createCompany(request.input, request.requestKey, request.actorId),
        ),
      previouslyUncertain,
      ['INVALID_INPUT', 'AUTH_REQUIRED', 'IDEMPOTENCY_KEY_REUSED', 'OFFLINE_TEAM_WRITE_BLOCKED'],
      'Company',
    );
    return { companyId: result.value, journalCleared: result.journalCleared };
  }
}
