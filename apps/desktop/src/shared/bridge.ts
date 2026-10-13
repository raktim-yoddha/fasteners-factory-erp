import type {
  Authority,
  CommandRequest,
  CommandResult,
  CreateWorkspace,
  Snapshot,
  Workspace,
} from '@fasteners/contracts';
export interface DesktopBridge {
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(input: CreateWorkspace): Promise<Workspace>;
  snapshot(authority: Authority): Promise<Snapshot>;
  execute(request: CommandRequest): Promise<CommandResult>;
  exportEncryptedDatabase(passphrase: string): Promise<void>;
  authGet(key: string): Promise<string | null>;
  authSet(key: string, value: string): Promise<void>;
  authRemove(key: string): Promise<void>;
}
declare global {
  interface Window {
    factory: DesktopBridge;
  }
}
