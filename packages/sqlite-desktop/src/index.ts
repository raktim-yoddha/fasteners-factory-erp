import Database from 'better-sqlite3';
import {
  normalizeSqlRows,
  type SqlDriver,
  type SqlExecutor,
  type SqlRow,
  type SqlValue,
} from '@fasteners/sqlite-schema';

export class DesktopSqlDriver implements SqlDriver {
  private readonly db: Database.Database;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly direct: SqlExecutor;
  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.defaultSafeIntegers(true);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = DELETE');
    this.db.pragma('busy_timeout = 5000');
    this.direct = {
      run: async (sql, parameters = []) => {
        if (parameters.length) this.db.prepare(sql).run(...parameters);
        else this.db.exec(sql);
      },
      all: async (sql, parameters = []) =>
        normalizeSqlRows(this.db.prepare(sql).all(...parameters) as Record<string, unknown>[]),
    };
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }
  run(sql: string, parameters: SqlValue[] = []): Promise<void> {
    return this.enqueue(() => this.direct.run(sql, parameters));
  }
  all(sql: string, parameters: SqlValue[] = []): Promise<SqlRow[]> {
    return this.enqueue(() => this.direct.all(sql, parameters));
  }
  transaction<T>(operation: (transaction: SqlExecutor) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const value = await operation(this.direct);
        this.db.exec('COMMIT');
        return value;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    });
  }
  async exportDatabase(): Promise<Uint8Array> {
    return this.enqueue(async () => new Uint8Array(this.db.serialize()));
  }
  async close(): Promise<void> {
    await this.enqueue(async () => {
      this.db.close();
    });
  }
}
