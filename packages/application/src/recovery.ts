import type { RecoveryPreview, Workspace } from '@fasteners/contracts';

export interface SnapshotRecoveryPort {
  preview(passphrase: string): Promise<RecoveryPreview>;
  activate(token: string): Promise<Workspace[]>;
  cancel(token: string): Promise<void>;
}
export interface RecoveryJournal {
  read(): RecoveryPreview | null;
  save(preview: RecoveryPreview): void;
  clear(): void;
}
