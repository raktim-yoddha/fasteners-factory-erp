import {
  administrationOperationSchema,
  administrationRequestSchema,
  administrationResultSchema,
  DomainError,
  type AdministrationOperation,
  type AdministrationRequest,
  type AdministrationResult,
} from '@fasteners/contracts';
import type { TeamAdministrationPort, TeamAuthPort } from './index';
import {
  confirmDurableRequest,
  requireVerifiedActor,
  type DurableCommit,
  type DurableRequestStore,
} from './durable-request';

export type AdministrationStore = DurableRequestStore<AdministrationRequest>;
export type AdministrationCommit = DurableCommit<AdministrationResult>;
export class AdministrationController {
  constructor(
    private readonly auth: TeamAuthPort,
    private readonly administration: TeamAdministrationPort,
    private readonly store: AdministrationStore,
  ) {}
  read(actorId: string): AdministrationRequest | null {
    return this.store.read(actorId);
  }
  async submit(
    actorId: string,
    companyId: string,
    operation: AdministrationOperation,
  ): Promise<AdministrationCommit> {
    const parsed = administrationRequestSchema.safeParse({
      contractVersion: 1,
      actorId,
      companyId,
      requestKey: crypto.randomUUID(),
      operation,
    });
    if (!parsed.success)
      throw new DomainError('INVALID_INPUT', 'Check the administration fields and company.');
    return this.store.exclusive(actorId, async () => {
      if (this.read(actorId))
        throw new DomainError(
          'CONFIRMATION_UNKNOWN',
          'Resolve the original administration request first.',
        );
      return this.dispatch(parsed.data, false);
    });
  }
  async retry(actorId: string): Promise<AdministrationCommit> {
    return this.store.exclusive(actorId, async () => {
      const original = this.read(actorId);
      if (!original)
        throw new DomainError('INVALID_INPUT', 'No original administration request exists.');
      return this.dispatch(original, true);
    });
  }
  private async dispatch(
    request: AdministrationRequest,
    previouslyUncertain: boolean,
  ): Promise<AdministrationCommit> {
    administrationOperationSchema.parse(request.operation);
    await requireVerifiedActor(this.auth, request.actorId);
    return confirmDurableRequest(
      request,
      this.store,
      async () => {
        const value = administrationResultSchema.parse(await this.administration.execute(request));
        if (
          value.command !== request.operation.command ||
          (value.command === 'update_member_access' &&
            request.operation.command === 'update_member_access' &&
            value.id !== request.operation.input.id)
        )
          throw new Error('Foreign administration confirmation');
        return value;
      },
      previouslyUncertain,
      [
        'AUTH_REQUIRED',
        'PERMISSION_DENIED',
        'INVALID_INPUT',
        'IDEMPOTENCY_KEY_REUSED',
        'OFFLINE_TEAM_WRITE_BLOCKED',
      ],
      'Administration',
    );
  }
}
