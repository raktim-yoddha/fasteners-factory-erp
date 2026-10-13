import { DomainError, type ErrorCode } from '@fasteners/contracts';
import type { TeamAuthPort } from './index';

export interface DurableRequestStore<T> {
  read(actorId: string): T | null;
  save(request: T): void;
  clear(request: T): void;
  exclusive<R>(actorId: string, operation: () => Promise<R>): Promise<R>;
}
export interface DurableCommit<T> {
  value: T;
  journalCleared: boolean;
}
export async function requireVerifiedActor(auth: TeamAuthPort, actorId: string): Promise<void> {
  const current = await auth.currentUser();
  if (!current?.verified || current.id !== actorId)
    throw new DomainError(
      'AUTH_REQUIRED',
      'Sign in with the original verified account before sending this request.',
    );
}
export async function confirmDurableRequest<T, R>(
  request: T,
  store: DurableRequestStore<T>,
  operation: () => Promise<R>,
  previouslyUncertain: boolean,
  definitiveCodes: readonly ErrorCode[],
  label: string,
): Promise<DurableCommit<R>> {
  store.save(request);
  let value: R;
  try {
    value = await operation();
  } catch (cause) {
    if (
      !previouslyUncertain &&
      cause instanceof DomainError &&
      definitiveCodes.includes(cause.code)
    ) {
      store.clear(request);
      throw cause;
    }
    throw new DomainError(
      'CONFIRMATION_UNKNOWN',
      `${label} confirmation unknown. Retry the retained original request with the same account.`,
    );
  }
  try {
    store.clear(request);
    return { value, journalCleared: true };
  } catch {
    // A committed authority outcome remains committed when local cleanup fails.
    return { value, journalCleared: false };
  }
}
