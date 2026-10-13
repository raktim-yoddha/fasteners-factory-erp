import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../shared/bridge';
type Reply<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
async function invoke<T>(method: string, ...args: unknown[]): Promise<T> {
  const reply = (await ipcRenderer.invoke('factory:operation', { method, args })) as Reply<T>;
  if (!reply.ok) throw new Error(`${reply.error.code}: ${reply.error.message}`);
  return reply.value;
}
const bridge: DesktopBridge = {
  listWorkspaces: () => invoke('listWorkspaces'),
  createWorkspace: (input) => invoke('createWorkspace', input),
  snapshot: (authority) => invoke('snapshot', authority),
  execute: (request) => invoke('execute', request),
  exportEncryptedDatabase: (passphrase) => invoke('exportEncryptedDatabase', passphrase),
  previewRestore: (passphrase) => invoke('previewRestore', passphrase),
  activateRestore: (token) => invoke('activateRestore', token),
  cancelRestore: (token) => invoke('cancelRestore', token),
  authGet: (key) => invoke('authGet', key),
  authSet: (key, value) => invoke('authSet', key, value),
  authRemove: (key) => invoke('authRemove', key),
};
contextBridge.exposeInMainWorld('factory', Object.freeze(bridge));
