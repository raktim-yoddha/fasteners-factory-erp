import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export const container = 'supabase_db_fasteners-factory-erp-desktop';
export const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
export function docker(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '',
      error = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      error += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`Local PostgreSQL tool failed: ${error.slice(-1200)}`)),
    );
    child.stdin.on('error', () => undefined);
    child.stdin.end(input);
  });
}
export function query(database, sql) {
  return docker(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-qAt',
      '-U',
      'postgres',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    sql,
  );
}

export class PostgresSession {
  constructor(database, name) {
    this.name = name;
    this.buffer = '';
    this.output = '';
    this.error = '';
    this.pending = null;
    this.child = spawn(
      'docker',
      [
        'exec',
        '-i',
        container,
        'psql',
        '-X',
        '-qAt',
        '-U',
        'postgres',
        '-d',
        database,
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    this.child.stdout.on('data', (chunk) => {
      this.buffer += chunk;
      let end;
      while ((end = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, end).replace(/\r$/, '');
        this.buffer = this.buffer.slice(end + 1);
        if (this.pending && line === this.pending.marker) {
          const pending = this.pending;
          this.pending = null;
          clearTimeout(pending.timeout);
          pending.resolve(this.output.trim());
          this.output = '';
        } else this.output += `${line}\n`;
      }
    });
    this.child.stderr.on('data', (chunk) => {
      this.error += chunk;
    });
    this.child.on('error', (error) => this.reject(error));
    this.closed = new Promise((resolve) =>
      this.child.on('close', (code) => {
        this.reject(
          new Error(`Owned PostgreSQL session stopped (${code}): ${this.error.slice(-1000)}`),
        );
        resolve();
      }),
    );
    this.child.stdin.on('error', (error) => this.reject(error));
  }
  reject(error) {
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(error);
      this.pending = null;
    }
  }
  run(sql) {
    if (this.pending) throw new Error('One operation per owned PostgreSQL session is required.');
    const result = new Promise((resolve, reject) => {
      const marker = `FF_${randomUUID().replaceAll('-', '')}`;
      const timeout = setTimeout(() => {
        this.reject(new Error('Owned PostgreSQL session timed out.'));
        this.child.kill();
      }, 15000);
      this.pending = { marker, timeout, resolve, reject };
      this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
    result.catch(() => undefined); // The orchestration awaits each result; prevent early rejection becoming unhandled while a lock is inspected.
    return result;
  }
  async ready(actor) {
    await this.run(
      `SET application_name=${literal(this.name)}; SET statement_timeout='12s'; ${actor ? `SET ROLE authenticated; SET request.jwt.claims=${literal(JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal1' }))};` : ''}`,
    );
    return this;
  }
  async close() {
    if (!this.child.stdin.destroyed) this.child.stdin.end('\\q\n');
    const timeout = setTimeout(() => this.child.kill(), 1000);
    await this.closed;
    clearTimeout(timeout);
  }
}
