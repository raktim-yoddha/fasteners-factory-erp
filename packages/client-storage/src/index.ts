import {
  authorityKey,
  DomainError,
  parseCommand,
  type Authority,
  type CommandRequest,
} from '@fasteners/contracts';
import type { PendingCommandStore } from '@fasteners/application';
export { LocalRecoveryJournal } from './recovery';
export { CompanySetupJournal } from './company-setup';

export class PendingJournal implements PendingCommandStore {
  constructor(
    private readonly source:
      | Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
      | (() => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>),
  ) {}
  private get storage() {
    return typeof this.source === 'function' ? this.source() : this.source;
  }
  private key(actor: string, authority: Authority): string {
    return `fasteners-pending:v1:${actor}:${authorityKey(authority)}`;
  }
  read(actor: string, authority: Authority): CommandRequest | null {
    try {
      const serialized = this.storage.getItem(this.key(actor, authority));
      if (serialized === null) return null;
      const request = parseCommand(JSON.parse(serialized));
      if (authorityKey(request.authority) !== authorityKey(authority))
        throw new Error('Scope mismatch');
      return request;
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Pending request storage is unavailable or invalid. Preserve it for recovery; no new command was sent.',
      );
    }
  }
  save(actor: string, command: CommandRequest): void {
    try {
      const previous = this.read(actor, command.authority);
      if (previous && JSON.stringify(previous) !== JSON.stringify(command))
        throw new Error('Another request remains unresolved');
      this.storage.setItem(
        this.key(actor, command.authority),
        JSON.stringify(parseCommand(command)),
      );
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Could not retain the original request before dispatch. Resolve the pending journal or storage failure first.',
      );
    }
  }
  clear(actor: string, authority: Authority): void {
    this.storage.removeItem(this.key(actor, authority));
  }
}

export { AdministrationJournal } from './administration';
