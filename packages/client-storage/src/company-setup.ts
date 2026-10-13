import {
  companySetupRequestSchema,
  DomainError,
  identifierSchema,
  type CompanySetupRequest,
} from '@fasteners/contracts';
import type { CompanySetupStore } from '@fasteners/application';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class CompanySetupJournal implements CompanySetupStore {
  constructor(
    private readonly source: StoragePort | (() => StoragePort),
    private readonly backendUrl: string,
    private readonly locks: () => Pick<LockManager, 'request'> = () => navigator.locks,
  ) {}
  private get storage() {
    return typeof this.source === 'function' ? this.source() : this.source;
  }
  private key(actorId: string) {
    const endpoint = new URL(this.backendUrl);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
      throw new Error('Invalid backend identity');
    return `fasteners-company-setup:v1:${encodeURIComponent(endpoint.origin)}:${identifierSchema.parse(actorId)}`;
  }
  read(actorId: string): CompanySetupRequest | null {
    try {
      const value = this.storage.getItem(this.key(actorId));
      if (value === null) return null;
      if (value.length > 4096) throw new Error('Oversized journal');
      const request = companySetupRequestSchema.parse(JSON.parse(value));
      if (request.actorId !== actorId) throw new Error('Account mismatch');
      return request;
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Company request storage is unavailable or invalid. Preserve it for recovery; no new request was sent.',
      );
    }
  }
  save(request: CompanySetupRequest): void {
    try {
      const validated = companySetupRequestSchema.parse(request);
      const previous = this.read(validated.actorId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(validated))
        throw new Error('Unresolved original');
      this.storage.setItem(this.key(validated.actorId), JSON.stringify(validated));
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Could not retain company setup before dispatch. Resolve storage or the original request first.',
      );
    }
  }
  clear(request: CompanySetupRequest): void {
    try {
      const previous = this.read(request.actorId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(request))
        throw new Error('Different original');
      this.storage.removeItem(this.key(request.actorId));
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Company request cleanup failed. Preserve the original request and retry its confirmation.',
      );
    }
  }
  async exclusive<T>(actorId: string, operation: () => Promise<T>): Promise<T> {
    let locks: Pick<LockManager, 'request'>;
    try {
      locks = this.locks();
      if (!locks?.request) throw new Error('Writer lock unavailable');
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Company setup needs a device writer lock before it can send requests.',
      );
    }
    return locks.request(
      this.key(actorId),
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock)
          throw new DomainError(
            'WORKSPACE_BUSY',
            'Another window is submitting company setup for this account.',
          );
        return operation();
      },
    );
  }
}
