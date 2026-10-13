import { _electron, expect, test, type ElectronApplication } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decryptDatabase } from '../../packages/backup/src';
const require = createRequire(new URL('../../apps/desktop/package.json', import.meta.url));
test('Electron stores SAMPLE data in utility-process SQLite and reopens it after process exit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-desktop-test-'));
  const userData = join(directory, 'user-data');
  await mkdir(userData);
  let application: ElectronApplication | undefined;
  try {
    const launch = () =>
      _electron.launch({
        executablePath:
          process.env.FASTENERS_PACKAGED_EXECUTABLE ?? (require('electron') as string),
        args: process.env.FASTENERS_PACKAGED_EXECUTABLE ? [] : [resolve('apps/desktop')],
        env: { ...process.env, FASTENERS_TEST_USER_DATA: userData },
        timeout: 30000,
      });
    application = await launch();
    const window = await application.firstWindow();
    await window.getByRole('button', { name: 'Start locally' }).click();
    await window.getByRole('button', { name: 'Load fictional SAMPLE workspace' }).click();
    await expect(
      window.getByRole('heading', { name: 'A clear view of your floor.' }),
    ).toBeVisible();
    const isolation = await window.evaluate(async () => ({
      require: typeof Reflect.get(globalThis, 'require'),
      process: typeof Reflect.get(globalThis, 'process'),
      writerLock: await navigator.locks.request('SAMPLE-company-setup-acceptance', async (lock) =>
        Boolean(lock),
      ),
    }));
    expect(isolation).toEqual({ require: 'undefined', process: 'undefined', writerLock: true });
    const forgedSender = await application.evaluate(async ({ BrowserWindow, app }) => {
      const outsider = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: `${app.getAppPath()}/dist/preload.cjs`,
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      try {
        await outsider.loadURL('factory://app/index.html');
        return await outsider.webContents.executeJavaScript(
          "window.factory.listWorkspaces().then(()=> 'UNEXPECTED_SUCCESS', error => error.message)",
        );
      } finally {
        outsider.destroy();
      }
    });
    expect(forgedSender).toMatch(/^PERMISSION_DENIED:/);
    const filename = join(directory, 'sample-database.fferp');
    await application.evaluate(({ dialog }, filePath) => {
      // Test the complete export operation while supplying a deterministic OS-dialog destination.
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, filename);
    await window.getByRole('link', { name: 'Workspace settings' }).click();
    await window.getByRole('button', { name: 'Export encrypted database snapshot' }).click();
    await window
      .getByLabel('Snapshot passphrase (at least 12 characters)')
      .fill('SAMPLE-test-passphrase-123');
    await window.getByLabel('Confirm passphrase').fill('SAMPLE-test-passphrase-123');
    await window.getByRole('button', { name: 'Choose destination and export' }).click();
    await expect(window.getByRole('dialog')).toHaveCount(0);
    const restoredBytes = await decryptDatabase(
      new Uint8Array(await readFile(filename)),
      'SAMPLE-test-passphrase-123',
    );
    expect(new TextDecoder().decode(restoredBytes.database.slice(0, 16))).toBe('SQLite format 3\0');
    await window.evaluate(async () => {
      const workspace = (await globalThis.window.factory.listWorkspaces())[0]!;
      const authority = { kind: 'solo' as const, workspaceId: workspace.id };
      const snapshot = await globalThis.window.factory.snapshot(authority);
      const command = {
        contractVersion: 1 as const,
        command: 'receive_goods' as const,
        authority,
        idempotencyKey: crypto.randomUUID(),
        payload: {
          itemId: snapshot.lots[0]!.itemId,
          quantity: '1',
          location: 'SAMPLE lost response',
          supplierReference: 'SAMPLE',
        },
      };
      localStorage.setItem(
        `fasteners-pending:v1:local-owner:solo:${workspace.id}`,
        JSON.stringify(command),
      );
      const result = await globalThis.window.factory.execute(command);
      if (!result.ok) throw new Error('SAMPLE lost-response fixture failed.');
      // Leave the journal intact to simulate an authority commit followed by a lost acknowledgment.
    });
    await application.evaluate(({ app }) => app.exit(0));
    application = await launch();
    const reopened = await application.firstWindow();
    await reopened.getByRole('button', { name: 'Start locally' }).click();
    await expect(
      reopened.getByRole('heading', { name: 'SAMPLE Factory A', exact: true }),
    ).toBeVisible();
    await reopened.getByRole('button', { name: 'Open workspace' }).click();
    await expect(
      reopened.getByText('Confirmation unknown — restored original request after restart.'),
    ).toBeVisible();
    await reopened.getByRole('button', { name: 'Retry original request' }).click();
    await expect(reopened.getByRole('button', { name: 'Retry original request' })).toHaveCount(0);
    const afterRetry = await reopened.evaluate(async () => {
      const workspace = (await globalThis.window.factory.listWorkspaces())[0]!;
      return globalThis.window.factory.snapshot({ kind: 'solo', workspaceId: workspace.id });
    });
    expect(afterRetry.lots).toHaveLength(2);
    expect(afterRetry.audit.filter((event) => event.command === 'receive_goods')).toHaveLength(2);
    await expect(
      reopened.evaluate(() => Object.keys(globalThis.window.factory).sort()),
    ).resolves.toEqual(
      [
        'authGet',
        'authRemove',
        'authSet',
        'createWorkspace',
        'execute',
        'exportEncryptedDatabase',
        'previewRestore',
        'activateRestore',
        'cancelRestore',
        'listWorkspaces',
        'snapshot',
      ].sort(),
    );
    await application.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, filename);
    await reopened.getByRole('button', { name: 'Change mode', exact: true }).click();
    await reopened.getByRole('button', { name: 'Start locally' }).click();
    await reopened.getByRole('button', { name: 'Restore encrypted snapshot', exact: true }).click();
    await reopened
      .getByLabel('Backup passphrase (at least 12 characters)')
      .fill('SAMPLE-wrong-passphrase');
    await reopened.getByRole('button', { name: 'Choose snapshot and review' }).click();
    await expect(reopened.getByRole('alert')).toContainText('authentication');
    await reopened
      .getByLabel('Backup passphrase (at least 12 characters)')
      .fill('SAMPLE-test-passphrase-123');
    await reopened.getByRole('button', { name: 'Choose snapshot and review' }).click();
    await expect(
      reopened.getByRole('button', { name: 'Activate reviewed snapshot' }),
    ).toBeVisible();
    await reopened.getByRole('button', { name: 'Activate reviewed snapshot' }).click();
    await expect(reopened.getByRole('dialog')).toHaveCount(0);
    expect(await reopened.evaluate(() => localStorage.getItem('fasteners-restore:v1'))).toBeNull();
    // Activate another reviewed copy of the same fictional snapshot, retaining its journal to simulate a lost acknowledgment.
    await reopened.evaluate(async () => {
      const preview = await globalThis.window.factory.previewRestore('SAMPLE-test-passphrase-123');
      localStorage.setItem('fasteners-restore:v1', JSON.stringify(preview));
      await globalThis.window.factory.activateRestore(preview.token);
    });
    await application.evaluate(({ app }) => app.exit(0));
    application = await launch();
    const restored = await application.firstWindow();
    await restored.getByRole('button', { name: 'Start locally' }).click();
    await expect(
      restored.getByText(
        'Confirmation unknown — retry the original restore token to resolve the selected database.',
      ),
    ).toBeVisible();
    await expect(restored.getByRole('button', { name: 'Open workspace' })).toBeDisabled();
    await restored.getByRole('button', { name: 'Retry original restore' }).click();
    await expect(restored.getByRole('dialog')).toHaveCount(0);
    await restored.getByRole('button', { name: 'Open workspace' }).click();
    const restoredSnapshot = await restored.evaluate(async () => {
      const workspace = (await globalThis.window.factory.listWorkspaces())[0]!;
      return globalThis.window.factory.snapshot({ kind: 'solo', workspaceId: workspace.id });
    });
    expect(restoredSnapshot.lots).toHaveLength(1);
    expect(
      restoredSnapshot.audit.filter((event) => event.command === 'receive_goods'),
    ).toHaveLength(1);
    const oldDatabase = join(userData, 'solo', 'factory-solo.sqlite3');
    expect((await readFile(oldDatabase)).slice(0, 16).toString()).toBe('SQLite format 3\0');
    await restored.evaluate(() => localStorage.setItem('fasteners-restore:v1', '{}'));
    await restored.getByRole('button', { name: 'Change mode', exact: true }).click();
    await restored.getByRole('button', { name: 'Start locally' }).click();
    await expect(restored.getByRole('alert')).toContainText(
      'Restore confirmation storage is unavailable or invalid',
    );
    await expect(restored.getByRole('button', { name: 'Create empty workspace' })).toHaveCount(0);
    await application.evaluate(({ app }) => app.exit(0));
    application = undefined;
  } finally {
    if (application) await application.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'factory-desktop-test-')))
      throw new Error('Unsafe test cleanup path.');
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
