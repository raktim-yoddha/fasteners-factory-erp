import { DomainError, recoveryPreviewSchema, type RecoveryPreview } from '@fasteners/contracts';
import type { RecoveryJournal } from '@fasteners/application';

export class LocalRecoveryJournal implements RecoveryJournal {
  constructor(private readonly source: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {}
  private readonly key = 'fasteners-restore:v1';
  read(): RecoveryPreview | null {
    try {
      const value = this.source().getItem(this.key);
      return value === null ? null : recoveryPreviewSchema.parse(JSON.parse(value));
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Restore confirmation storage is unavailable or invalid. Preserve it for recovery.',
      );
    }
  }
  save(preview: RecoveryPreview): void {
    try {
      const previous = this.read();
      if (previous && previous.token !== preview.token)
        throw new Error('Another restore is unresolved.');
      this.source().setItem(this.key, JSON.stringify(recoveryPreviewSchema.parse(preview)));
    } catch {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Could not retain the restore token. No activation was sent.',
      );
    }
  }
  clear(): void {
    this.source().removeItem(this.key);
  }
}
