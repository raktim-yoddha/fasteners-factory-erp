import { utilityProcess, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DomainError } from '@fasteners/contracts';
interface Reply {
  id?: string;
  ready?: boolean;
  ok?: boolean;
  value?: unknown;
  error?: { code: string; message: string };
}
export class DatabaseClient {
  private readonly process: UtilityProcess;
  private readonly pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly ready: Promise<void>;
  private alive = true;
  constructor(bundleDirectory: string, dataDirectory: string) {
    this.process = utilityProcess.fork(join(bundleDirectory, 'database.cjs'), [dataDirectory], {
      serviceName: 'Factory local SQLite',
      stdio: 'pipe',
    });
    this.ready = new Promise((resolve, reject) => {
      this.process.on('message', (reply: Reply) => {
        if (reply.ready) {
          resolve();
          return;
        }
        if (!reply.id) return;
        const callback = this.pending.get(reply.id);
        if (!callback) return;
        this.pending.delete(reply.id);
        if (reply.ok) callback.resolve(reply.value);
        else
          callback.reject(
            new DomainError(
              reply.error?.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'STORAGE_UNAVAILABLE',
              reply.error?.message ?? 'Database request failed.',
            ),
          );
      });
      this.process.on('exit', () => {
        this.alive = false;
        const error = new DomainError(
          'CONFIRMATION_UNKNOWN',
          'The SQLite utility process stopped. Restart and retry the original request key to confirm its outcome.',
        );
        reject(error);
        for (const callback of this.pending.values()) callback.reject(error);
        this.pending.clear();
      });
    });
  }
  async call<T>(method: string, args: unknown[] = []): Promise<T> {
    await this.ready;
    if (!this.alive)
      throw new DomainError('STORAGE_UNAVAILABLE', 'The database process is unavailable.');
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.process.postMessage({ id, method, args });
    });
  }
  async close(): Promise<void> {
    if (this.alive) {
      await this.call('close');
      this.process.kill();
    }
  }
}
