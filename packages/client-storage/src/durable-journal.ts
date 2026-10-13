import { DomainError, identifierSchema } from '@fasteners/contracts';
import type { DurableRequestStore } from '@fasteners/application';

export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class DurableJournal<
  T extends { actorId: string; requestKey: string },
> implements DurableRequestStore<T> {
  constructor(
    private readonly source: StoragePort | (() => StoragePort),
    private readonly backendUrl: string,
    private readonly namespace: string,
    private readonly label: string,
    private readonly parse: (value: unknown) => T,
    private readonly maxLength: number,
    private readonly locks: () => Pick<LockManager, 'request'> = () => navigator.locks,
  ) {}
  private get storage() {
    return typeof this.source === 'function' ? this.source() : this.source;
  }
  private key(actorId: string) {
    const endpoint = new URL(this.backendUrl);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
      throw new Error('Invalid backend identity');
    return `${this.namespace}:${encodeURIComponent(endpoint.origin)}:${identifierSchema.parse(actorId)}`;
  }
  read(actorId: string): T | null {
    try {
      const value = this.storage.getItem(this.key(actorId));
      if (value === null) return null;
      if (value.length > this.maxLength) throw new Error('Oversized journal');
      const request = this.parse(JSON.parse(value));
      if (request.actorId !== actorId) throw new Error('Account mismatch');
      return request;
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        `${this.label} request storage is unavailable or invalid. Preserve it for recovery; no new request was sent.`,
      );
    }
  }
  save(request: T): void {
    try {
      const validated = this.parse(request);
      const previous = this.read(validated.actorId);
      const value = JSON.stringify(validated);
      if (value.length > this.maxLength || (previous && JSON.stringify(previous) !== value))
        throw new Error('Unresolved original or oversized request');
      this.storage.setItem(this.key(validated.actorId), value);
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        `Could not retain ${this.label.toLowerCase()} setup before dispatch. Resolve storage or the original request first.`,
      );
    }
  }
  clear(request: T): void {
    try {
      const previous = this.read(request.actorId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(request))
        throw new Error('Different original');
      this.storage.removeItem(this.key(request.actorId));
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        `${this.label} request cleanup failed. Preserve the original request and retry its confirmation.`,
      );
    }
  }
  async exclusive<R>(actorId: string, operation: () => Promise<R>): Promise<R> {
    let locks: Pick<LockManager, 'request'>;
    try {
      locks = this.locks();
      if (!locks?.request) throw new Error('Writer lock unavailable');
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        `${this.label} setup needs a device writer lock before it can send requests.`,
      );
    }
    return locks.request(
      this.key(actorId),
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock)
          throw new DomainError(
            'WORKSPACE_BUSY',
            `Another window is submitting ${this.label.toLowerCase()} setup for this account.`,
          );
        return operation();
      },
    );
  }
}
