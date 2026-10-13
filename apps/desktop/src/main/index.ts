import { app, BrowserWindow, dialog, ipcMain, protocol, session, shell } from 'electron';
import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { authoritySchema, parseCommand, DomainError } from '@fasteners/contracts';
import { encryptDatabase } from '@fasteners/backup';
import { DatabaseClient } from './database-client';
import { Credentials } from './credentials';
import { saveEncryptedFile } from './backup-file';
const bundleDirectory = dirname(fileURLToPath(import.meta.url));
const rendererDirectory = join(bundleDirectory, 'renderer');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'factory',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
let window: BrowserWindow | null = null;
let database: DatabaseClient | undefined;
const createWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    currency: z.string().regex(/^[A-Z]{3}$/),
    timezone: z.string().min(1).max(80),
  })
  .strict();
const operationSchema = z
  .object({
    method: z.enum([
      'listWorkspaces',
      'createWorkspace',
      'snapshot',
      'execute',
      'exportEncryptedDatabase',
      'authGet',
      'authSet',
      'authRemove',
    ]),
    args: z.array(z.unknown()).max(2),
  })
  .strict();
const expectedArgs: Record<z.infer<typeof operationSchema>['method'], number> = {
  listWorkspaces: 0,
  createWorkspace: 1,
  snapshot: 1,
  execute: 1,
  exportEncryptedDatabase: 1,
  authGet: 1,
  authSet: 2,
  authRemove: 1,
};
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
function inside(root: string, filename: string): boolean {
  const difference = relative(root, filename);
  return difference !== '' && !/^\.\.(?:[\\/]|$)/.test(difference) && !isAbsolute(difference);
}
async function start() {
  let acceptanceStorage = false;
  if (process.env.FASTENERS_TEST_USER_DATA) {
    const requested = normalize(process.env.FASTENERS_TEST_USER_DATA);
    const testPath = relative(tmpdir(), requested);
    if (
      !isAbsolute(requested) ||
      isAbsolute(testPath) ||
      !/^factory-desktop-test-[^\\/]+[\\/]user-data$/.test(testPath)
    )
      throw new DomainError(
        'INVALID_INPUT',
        'Acceptance storage must use a managed test directory under the OS temporary folder.',
      );
    app.setPath('userData', requested);
    acceptanceStorage = true;
  }
  database = new DatabaseClient(bundleDirectory, join(app.getPath('userData'), 'solo'));
  const credentials = new Credentials(join(app.getPath('userData'), 'credentials'));
  protocol.handle('factory', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Forbidden', { status: 403 });
    const requested = normalize(join(rendererDirectory, decodeURIComponent(url.pathname)));
    if (!inside(rendererDirectory, requested)) return new Response('Forbidden', { status: 403 });
    let filename = requested;
    let body: Buffer;
    try {
      body = await readFile(filename);
    } catch {
      if (extname(filename)) return new Response('Not found', { status: 404 });
      filename = join(rendererDirectory, 'index.html');
      body = await readFile(filename);
    }
    const csp =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https: wss: http://127.0.0.1:55321 ws://127.0.0.1:55321; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'";
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': mime[extname(filename)] ?? 'application/octet-stream',
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  ipcMain.handle('factory:operation', async (event, input: unknown) => {
    try {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !event.senderFrame.url.startsWith('factory://app/')
      )
        throw new DomainError('PERMISSION_DENIED', 'Untrusted IPC sender.');
      if (JSON.stringify(input).length > 150_000)
        throw new DomainError('INVALID_INPUT', 'Request exceeds the supported size.');
      const operation = operationSchema.parse(input);
      if (operation.args.length !== expectedArgs[operation.method])
        throw new DomainError('INVALID_INPUT', 'Incorrect operation arguments.');
      let value: unknown;
      switch (operation.method) {
        case 'listWorkspaces':
          value = await database!.call('listWorkspaces');
          break;
        case 'createWorkspace':
          value = await database!.call('createWorkspace', [
            createWorkspaceSchema.parse(operation.args[0]),
          ]);
          break;
        case 'snapshot':
          value = await database!.call('snapshot', [authoritySchema.parse(operation.args[0])]);
          break;
        case 'execute':
          value = await database!.call('execute', [parseCommand(operation.args[0])]);
          break;
        case 'exportEncryptedDatabase': {
          const passphrase = z.string().min(12).max(1024).parse(operation.args[0]);
          const snapshot = await database!.call<Uint8Array>('exportDatabase');
          const encrypted = await encryptDatabase(
            new Uint8Array(snapshot),
            passphrase,
            webcrypto as Crypto,
          );
          const result = await dialog.showSaveDialog(window, {
            title: 'Export encrypted local database backup',
            defaultPath: `factory-backup-${new Date().toISOString().slice(0, 10)}.fferp`,
            filters: [{ name: 'Encrypted Factory database', extensions: ['fferp'] }],
          });
          if (result.canceled) throw new DomainError('INVALID_INPUT', 'Backup export cancelled.');
          if (!result.filePath)
            throw new DomainError('INVALID_INPUT', 'No backup destination selected.');
          const destination = join(
            await realpath(dirname(result.filePath)),
            basename(result.filePath),
          );
          if (inside(await realpath(app.getPath('userData')), destination))
            throw new DomainError(
              'INVALID_INPUT',
              'Choose a backup destination outside the active application storage.',
            );
          await saveEncryptedFile(destination, encrypted);
          break;
        }
        case 'authGet':
          value = await credentials.get(z.string().parse(operation.args[0]));
          break;
        case 'authSet':
          await credentials.set(
            z.string().parse(operation.args[0]),
            z.string().parse(operation.args[1]),
          );
          break;
        case 'authRemove':
          await credentials.remove(z.string().parse(operation.args[0]));
          break;
      }
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: error instanceof DomainError ? error.code : 'INVALID_INPUT',
          message:
            error instanceof DomainError
              ? error.message
              : 'Operation rejected by the native boundary.',
        },
      };
    }
  });
  window = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 900,
    minHeight: 650,
    show: !acceptanceStorage,
    title: 'Fasteners Factory ERP',
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: join(bundleDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:') void shell.openExternal(target.toString());
    } catch {
      /* Invalid external targets are denied. */
    }
    return { action: 'deny' };
  });
  window.on('close', (event) => {
    if (window?.webContents.isDestroyed()) return;
    event.preventDefault();
    void dialog
      .showMessageBox(window!, {
        type: 'question',
        message: 'Close Factory ERP?',
        detail:
          'Confirm that no save is awaiting confirmation. Committed local records are retained.',
        buttons: ['Keep working', 'Close'],
        defaultId: 0,
        cancelId: 0,
      })
      .then(async (result) => {
        if (result.response === 1) {
          await database?.close();
          window?.destroy();
          window = null;
          app.quit();
        }
      });
  });
  await window.loadURL('factory://app/index.html');
}
if (ownsInstance) {
  app.on('second-instance', () => {
    window?.show();
    window?.focus();
  });
  void app
    .whenReady()
    .then(start)
    .catch(async () => {
      await dialog.showMessageBox({
        type: 'error',
        message: 'Factory ERP could not initialize its secure runtime.',
        detail:
          'Check local storage and the packaged SQLite module. No successful write is claimed.',
      });
      app.quit();
    });
}
app.on('window-all-closed', () => app.quit());
