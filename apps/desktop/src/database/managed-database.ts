import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DomainError, type RecoveryPreview } from '@fasteners/contracts';
import { initialize, LocalRepository } from '@fasteners/local-domain';
import { DesktopSqlDriver } from '@fasteners/sqlite-desktop';
import { nativeAtomicFileIO, writeAtomicFile, type AtomicFileIO } from '../shared/atomic-file';
import { validateSnapshot } from './validate-backup';

const pointerSchema = z
  .object({
    format: z.literal('FFERP-ACTIVE-DATABASE'),
    version: z.literal(1),
    filename: z.string().regex(/^restored-[0-9a-f-]{36}\.sqlite3$/),
    restoreToken: z.string().uuid(),
    activatedAt: z.string().datetime(),
  })
  .strict();
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
interface Pending {
  preview: RecoveryPreview;
  database: Uint8Array;
  previousHash: string;
}

/** Owns one serialized device database. Older selections are retained, never deleted. */
export class ManagedDatabase {
  driver!: DesktopSqlDriver;
  repository!: LocalRepository;
  private filename = '';
  private selection: z.infer<typeof pointerSchema> | null = null;
  private pending: Pending | null = null;
  private constructor(
    private readonly directory: string,
    private readonly io: AtomicFileIO,
    private readonly clock: () => number,
  ) {}
  static async open(
    directory: string,
    io: AtomicFileIO = nativeAtomicFileIO,
    clock: () => number = Date.now,
  ) {
    await mkdir(directory, { recursive: true });
    const managed = new ManagedDatabase(await realpath(directory), io, clock);
    try {
      const pointerDetails = await lstat(join(managed.directory, 'active-database.json'));
      if (!pointerDetails.isFile() || pointerDetails.isSymbolicLink())
        throw new Error('Invalid pointer file');
      const pointer = await readFile(join(managed.directory, 'active-database.json'));
      if (pointer.length > 4096) throw new Error('Pointer size');
      managed.selection = pointerSchema.parse(JSON.parse(pointer.toString('utf8')));
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
        throw new DomainError(
          'STORAGE_UNAVAILABLE',
          'The active database selector is invalid. Preserve managed data for recovery.',
        );
    }
    managed.filename = join(
      managed.directory,
      managed.selection?.filename ?? 'factory-solo.sqlite3',
    );
    if (managed.selection) {
      const details = await lstat(managed.filename);
      if (
        !details.isFile() ||
        details.isSymbolicLink() ||
        dirname(await realpath(managed.filename)) !== managed.directory
      )
        throw new DomainError(
          'STORAGE_UNAVAILABLE',
          'The selected database must be an existing managed file.',
        );
    }
    managed.driver = new DesktopSqlDriver(managed.filename);
    try {
      await initialize(managed.driver);
    } catch (error) {
      await managed.driver.close();
      throw error;
    }
    managed.repository = new LocalRepository(managed.driver, 'local-owner:desktop');
    return managed;
  }
  async preview(database: Uint8Array, createdAt: string): Promise<RecoveryPreview> {
    this.pending = null;
    const details = await validateSnapshot(database);
    const preview: RecoveryPreview = {
      ...details,
      token: randomUUID(),
      createdAt,
      expiresAt: new Date(this.clock() + 15 * 60_000).toISOString(),
      scope: 'all-device-solo-workspaces',
    };
    this.pending = {
      preview,
      database: database.slice(),
      previousHash: digest(await this.driver.exportDatabase()),
    };
    return preview;
  }
  cancel(token: string): void {
    if (this.pending?.preview.token === token) this.pending = null;
  }
  async activate(token: string) {
    if (this.selection?.restoreToken === token) return this.repository.listWorkspaces();
    const pending = this.pending;
    if (
      !pending ||
      pending.preview.token !== token ||
      this.clock() > Date.parse(pending.preview.expiresAt)
    )
      throw new DomainError(
        'BACKUP_INVALID',
        'The restore preview expired or is no longer available. No activation committed for this token.',
      );
    if (digest(await this.driver.exportDatabase()) !== pending.previousHash)
      throw new DomainError(
        'REVISION_CONFLICT',
        'Local data changed after preview. Review a fresh preview before restoring.',
      );
    const filename = `restored-${randomUUID()}.sqlite3`;
    const destination = join(this.directory, filename);
    let candidate: DesktopSqlDriver | undefined;
    let oldClosed = false;
    try {
      await this.io.write(destination, pending.database);
      const persisted = new Uint8Array(await readFile(destination));
      if (digest(persisted) !== digest(pending.database))
        throw new DomainError(
          'BACKUP_INVALID',
          'The staged restore did not match the verified snapshot.',
        );
      await validateSnapshot(persisted);
      candidate = new DesktopSqlDriver(destination);
      await initialize(candidate);
      await this.driver.close();
      oldClosed = true;
      const selection = pointerSchema.parse({
        format: 'FFERP-ACTIVE-DATABASE',
        version: 1,
        filename,
        restoreToken: token,
        activatedAt: new Date(this.clock()).toISOString(),
      });
      await writeAtomicFile(
        join(this.directory, 'active-database.json'),
        new TextEncoder().encode(JSON.stringify(selection)),
        this.io,
      );
      this.driver = candidate;
      this.repository = new LocalRepository(candidate, 'local-owner:desktop');
      this.filename = destination;
      this.selection = selection;
      this.pending = null;
      return pending.preview.workspaces;
    } catch (error) {
      if (oldClosed) {
        this.driver = new DesktopSqlDriver(this.filename);
        this.repository = new LocalRepository(this.driver, 'local-owner:desktop');
      }
      await candidate?.close();
      await this.io.remove(destination);
      throw error;
    }
  }
  async close() {
    this.pending = null;
    await this.driver.close();
  }
}
