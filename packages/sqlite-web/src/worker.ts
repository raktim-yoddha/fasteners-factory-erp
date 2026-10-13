/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {
  DomainError,
  type Authority,
  type CommandRequest,
  type CreateWorkspace,
} from '@fasteners/contracts';
import { initialize, LocalRepository } from '@fasteners/local-domain';
import { normalizeSqlRows, type SqlDriver, type SqlExecutor } from '@fasteners/sqlite-schema';

let releaseLock: (() => void) | undefined;
let exportDatabase: (() => Uint8Array) | undefined;
async function open(): Promise<LocalRepository> {
  if (!navigator.storage?.getDirectory || !navigator.locks)
    throw new DomainError(
      'STORAGE_UNAVAILABLE',
      'Persistent SQLite requires OPFS and Web Locks. Use supported Chrome/Edge or the desktop app.',
    );
  await navigator.storage.getDirectory();
  let confirmLock: (value: boolean) => void = () => undefined;
  const acquired = new Promise<boolean>((resolve) => {
    confirmLock = resolve;
  });
  void navigator.locks.request('fasteners-solo-writer', { ifAvailable: true }, async (lock) => {
    confirmLock(Boolean(lock));
    if (lock)
      await new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
  });
  if (!(await acquired))
    throw new DomainError(
      'WORKSPACE_BUSY',
      'Another tab owns the local writer. Close it before opening this workspace.',
    );
  try {
    const sqlite = await sqlite3InitModule();
    const pool = await sqlite.installOpfsSAHPoolVfs({
      directory: '/fasteners-solo-v1',
      initialCapacity: 6,
    });
    const db = new pool.OpfsSAHPoolDb('/factory.sqlite3');
    db.exec('PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON;');
    const direct: SqlExecutor = {
      run: async (sql, parameters = []) => {
        db.exec({ sql, bind: parameters });
      },
      all: async (sql, parameters = []) =>
        normalizeSqlRows(
          db.exec({
            sql,
            bind: parameters,
            rowMode: 'object',
            returnValue: 'resultRows',
          }) as Record<string, unknown>[],
        ),
    };
    const driver: SqlDriver = {
      ...direct,
      transaction: async (operation) => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const result = await operation(direct);
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
      close: async () => {
        db.close();
        pool.pauseVfs();
        releaseLock?.();
      },
    };
    exportDatabase = () => pool.exportFile('/factory.sqlite3');
    await initialize(driver);
    return new LocalRepository(driver, 'local-owner:browser');
  } catch (error) {
    releaseLock?.();
    throw error;
  }
}
let repository: Promise<LocalRepository> | undefined;
let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (event: MessageEvent<{ id: string; method: string; args: unknown[] }>) => {
  const message = event.data;
  queue = queue.then(async () => {
    try {
      repository ??= open();
      const local = await repository;
      let value: unknown;
      switch (message.method) {
        case 'listWorkspaces':
          value = await local.listWorkspaces();
          break;
        case 'createWorkspace':
          value = await local.createWorkspace(message.args[0] as CreateWorkspace);
          break;
        case 'snapshot':
          value = await local.snapshot(message.args[0] as Authority);
          break;
        case 'execute':
          value = await local.execute(message.args[0] as CommandRequest);
          break;
        case 'exportDatabase':
          value = exportDatabase?.();
          break;
        case 'close':
          value = await local.close();
          break;
        default:
          throw new DomainError('INVALID_INPUT', 'Unsupported worker operation.');
      }
      self.postMessage({ id: message.id, value });
    } catch (error) {
      self.postMessage({
        id: message.id,
        error: {
          code: error instanceof DomainError ? error.code : 'STORAGE_UNAVAILABLE',
          message:
            error instanceof DomainError
              ? error.message
              : 'Persistent SQLite could not be opened. Check available storage and browser support.',
        },
      });
    }
  });
};
