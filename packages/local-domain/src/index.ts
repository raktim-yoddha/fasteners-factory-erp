import {
  DomainError,
  parseCommand,
  type Authority,
  type CommandRequest,
  type CommandResult,
  type CreateWorkspace,
  type Repository,
  type Snapshot,
  type Workspace,
} from '@fasteners/contracts';
import { canonical, decimal } from '@fasteners/domain';
import { schema, schemaVersion, type SqlDriver, type SqlRow } from '@fasteners/sqlite-schema';
import { executeLocal } from './commands';
import { balance, mapRecord, now, one, reserved, text, uuid } from './database';

export const schemaChecksum = 'fasteners-sqlite-v1-core-2026-10-13';
export { validateRecoveryData } from './recovery-validation';
export async function initialize(driver: SqlDriver): Promise<void> {
  await driver.run(schema);
  const versions = await driver.all('SELECT * FROM schema_versions ORDER BY version DESC');
  if (
    versions[0] &&
    (Number(versions[0].version) !== schemaVersion || versions[0].checksum !== schemaChecksum)
  )
    throw new DomainError(
      'SCHEMA_INCOMPATIBLE',
      'This local schema is not supported by this application.',
    );
  if (!versions.length)
    await driver.run('INSERT INTO schema_versions(version,checksum) VALUES(?,?)', [
      schemaVersion,
      schemaChecksum,
    ]);
}
function workspace(row: SqlRow): Workspace {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    currency: text(row, 'currency'),
    timezone: text(row, 'timezone'),
    createdAt: text(row, 'created_at'),
  };
}
export class LocalRepository implements Repository {
  constructor(
    private readonly driver: SqlDriver,
    private readonly provenance = 'local-owner',
  ) {}
  async listWorkspaces(): Promise<Workspace[]> {
    return (await this.driver.all('SELECT * FROM workspaces ORDER BY created_at')).map(workspace);
  }
  async createWorkspace(input: CreateWorkspace): Promise<Workspace> {
    if (!input.name.trim() || input.name.length > 120 || !/^[A-Z]{3}$/.test(input.currency))
      throw new DomainError(
        'INVALID_INPUT',
        'Workspace name and three-letter currency are required.',
      );
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone });
    } catch {
      throw new DomainError('INVALID_INPUT', 'Select a valid timezone.');
    }
    const value: Workspace = {
      id: uuid(),
      name: input.name.trim(),
      currency: input.currency,
      timezone: input.timezone,
      createdAt: now(),
    };
    await this.driver.transaction(async (db) => {
      await db.run('INSERT INTO workspaces VALUES(?,?,?,?,?)', [
        value.id,
        value.name,
        value.currency,
        value.timezone,
        value.createdAt,
      ]);
    });
    return value;
  }
  private scope(authority: Authority): string {
    if (authority.kind !== 'solo')
      throw new DomainError('COMPANY_SCOPE_MISMATCH', 'Local SQLite cannot execute team commands.');
    return authority.workspaceId;
  }
  async execute(input: CommandRequest): Promise<CommandResult> {
    const correlationId = uuid();
    try {
      const request = parseCommand(input);
      const scope = this.scope(request.authority);
      return await this.driver.transaction(async (db) => {
        await one(db, 'SELECT id FROM workspaces WHERE id=?', [scope]);
        const fingerprint = canonical({
          payload: request.payload,
          expectedRevision: request.expectedRevision ?? null,
        });
        const previous = (
          await db.all(
            'SELECT fingerprint,result FROM idempotency WHERE workspace_id=? AND actor=? AND command=? AND request_key=?',
            [scope, this.provenance, request.command, request.idempotencyKey],
          )
        )[0];
        if (previous) {
          if (text(previous, 'fingerprint') !== fingerprint)
            throw new DomainError(
              'IDEMPOTENCY_KEY_REUSED',
              'This request key was already used with different input.',
            );
          return JSON.parse(text(previous, 'result')) as CommandResult;
        }
        const id = await executeLocal(db, scope, this.provenance, request);
        const committedAt = now();
        const result: CommandResult = {
          ok: true,
          value: { id, message: 'Committed to local SQLite.' },
          committedAt,
          authority: request.authority,
        };
        const reason =
          'reason' in request.payload
            ? String(request.payload.reason ?? '')
            : request.command === 'release_lot'
              ? 'owner_attestation; independent review not claimed'
              : request.command === 'receive_goods' && request.payload.supplierReference
                ? `Supplier reference: ${request.payload.supplierReference}`
                : '';
        await db.run('INSERT INTO audit VALUES(?,?,?,?,?,?,?)', [
          uuid(),
          scope,
          request.command,
          id,
          this.provenance,
          reason,
          committedAt,
        ]);
        await db.run('INSERT INTO idempotency VALUES(?,?,?,?,?,?)', [
          scope,
          this.provenance,
          request.command,
          request.idempotencyKey,
          fingerprint,
          JSON.stringify(result),
        ]);
        return result;
      });
    } catch (error) {
      const domain = error instanceof DomainError ? error : null;
      const constraint = error instanceof Error && /UNIQUE constraint/i.test(error.message);
      return {
        ok: false,
        error: {
          code: domain?.code ?? 'INVALID_INPUT',
          message:
            domain?.message ??
            (constraint
              ? 'This identifier already exists in the workspace.'
              : 'Command rejected. Validate the input and storage health.'),
          retryable: domain?.code === 'WORKSPACE_BUSY',
          correlationId,
        },
      };
    }
  }
  async snapshot(authority: Authority): Promise<Snapshot> {
    const scope = this.scope(authority);
    return this.driver.transaction(async (db) => {
      const metadata = workspace(await one(db, 'SELECT * FROM workspaces WHERE id=?', [scope]));
      const records = (
        await db.all(
          'SELECT * FROM records WHERE workspace_id=? ORDER BY created_at DESC LIMIT 200',
          [scope],
        )
      ).map(mapRecord);
      const rows = await db.all(
        'SELECT l.*,r.name AS item_name,r.fields AS item_fields FROM lots l JOIN records r ON r.id=l.item_id AND r.workspace_id=l.workspace_id WHERE l.workspace_id=? ORDER BY l.rowid DESC LIMIT 200',
        [scope],
      );
      const lots: Snapshot['lots'] = [];
      for (const row of rows) {
        const id = text(row, 'id');
        const onHand = await balance(db, scope, id);
        const committed = await reserved(db, scope, id);
        lots.push({
          id,
          code: text(row, 'code'),
          itemId: text(row, 'item_id'),
          itemName: text(row, 'item_name'),
          unit: (JSON.parse(text(row, 'item_fields')) as Record<string, string>).unit ?? '',
          location: text(row, 'location'),
          qcState: text(row, 'qc_state') as 'held' | 'released',
          onHand: decimal(onHand),
          reserved: decimal(committed),
          available: text(row, 'qc_state') === 'released' ? decimal(onHand - committed) : '0',
          wip: decimal(await balance(db, scope, id, 'wip')),
          vendor: decimal(await balance(db, scope, id, 'vendor')),
          revision: text(row, 'revision'),
        });
      }
      const reservations = (
        await db.all(
          'SELECT * FROM reservations WHERE workspace_id=? ORDER BY rowid DESC LIMIT 200',
          [scope],
        )
      ).map((row) => ({
        id: text(row, 'id'),
        lotId: text(row, 'lot_id'),
        orderId: text(row, 'order_id'),
        quantity: text(row, 'quantity'),
        state: text(row, 'state'),
      }));
      const packages = (
        await db.all('SELECT * FROM packages WHERE workspace_id=? ORDER BY rowid DESC LIMIT 200', [
          scope,
        ])
      ).map((row) => ({
        id: text(row, 'id'),
        reservationId: text(row, 'reservation_id'),
        code: text(row, 'code'),
        lotId: text(row, 'lot_id'),
        orderId: text(row, 'order_id'),
        quantity: text(row, 'quantity'),
        state: text(row, 'state'),
      }));
      const shipments = (
        await db.all(
          'SELECT * FROM shipments WHERE workspace_id=? ORDER BY created_at DESC LIMIT 200',
          [scope],
        )
      ).map((row) => ({
        id: text(row, 'id'),
        code: text(row, 'code'),
        lotId: text(row, 'lot_id'),
        orderId: text(row, 'order_id'),
        quantity: text(row, 'quantity'),
        carrier: text(row, 'carrier'),
        createdAt: text(row, 'created_at'),
      }));
      const audit = (
        await db.all(
          'SELECT * FROM audit WHERE workspace_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100',
          [scope],
        )
      ).map((row) => ({
        id: text(row, 'id'),
        command: text(row, 'command'),
        entityId: text(row, 'entity_id'),
        actor: text(row, 'actor'),
        reason: text(row, 'reason'),
        createdAt: text(row, 'created_at'),
      }));
      return {
        workspace: metadata,
        records,
        lots,
        reservations,
        packages,
        shipments,
        audit,
        asOf: now(),
      };
    });
  }
  async close(): Promise<void> {
    await this.driver.close();
  }
}
