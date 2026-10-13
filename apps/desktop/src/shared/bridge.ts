import type {
  Authority,
  CommandRequest,
  CommandResult,
  CreateWorkspace,
  Snapshot,
  Workspace,
  RecoveryPreview,
} from '@fasteners/contracts';
export interface DesktopBridge {
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(input: CreateWorkspace): Promise<Workspace>;
  snapshot(authority: Authority): Promise<Snapshot>;
  execute(request: CommandRequest): Promise<CommandResult>;
  exportEncryptedDatabase(passphrase: string): Promise<void>;
  previewRestore(passphrase: string): Promise<RecoveryPreview>;
  activateRestore(token: string): Promise<Workspace[]>;
  cancelRestore(token: string): Promise<void>;
  authGet(key: string): Promise<string | null>;
  authSet(key: string, value: string): Promise<void>;
  authRemove(key: string): Promise<void>;
}
declare global {
  interface Window {
    factory: DesktopBridge;
  }
}
