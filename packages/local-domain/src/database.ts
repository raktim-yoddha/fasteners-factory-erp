import { DomainError, type BusinessRecord, type EntityKind } from '@fasteners/contracts';
import { decimal, scaled } from '@fasteners/domain';
import type { SqlExecutor, SqlRow } from '@fasteners/sqlite-schema';

export const now = (): string => new Date().toISOString();
export const uuid = (): string => crypto.randomUUID();
export function text(row: SqlRow, key: string): string {
  const value = row[key];
  if (value === undefined || value === null)
    throw new DomainError('STORAGE_UNAVAILABLE', `Required stored field ${key} is missing.`);
  return String(value);
}
export async function one(
  db: SqlExecutor,
  sql: string,
  parameters: (string | number | null)[],
): Promise<SqlRow> {
  const row = (await db.all(sql, parameters))[0];
  if (!row) throw new DomainError('INVALID_INPUT', 'Record is unavailable in this workspace.');
  return row;
}
export function mapRecord(row: SqlRow): BusinessRecord {
  return {
    id: text(row, 'id'),
    kind: text(row, 'kind') as EntityKind,
    code: text(row, 'code'),
    name: text(row, 'name'),
    state: text(row, 'state'),
    revision: text(row, 'revision'),
    fields: JSON.parse(text(row, 'fields')) as Record<string, string>,
    createdAt: text(row, 'created_at'),
  };
}
export async function getRecord(
  db: SqlExecutor,
  scope: string,
  id: string,
  kind?: EntityKind,
): Promise<BusinessRecord> {
  const record = mapRecord(
    await one(db, 'SELECT * FROM records WHERE workspace_id=? AND id=?', [scope, id]),
  );
  if (kind && record.kind !== kind)
    throw new DomainError('INVALID_INPUT', `Select a ${kind} record.`);
  return record;
}
export async function getLot(db: SqlExecutor, scope: string, id: string): Promise<SqlRow> {
  const lot = await one(db, 'SELECT * FROM lots WHERE workspace_id=? AND id=?', [scope, id]);
  checkRevision(text(lot, 'revision'));
  return lot;
}
export function checkRevision(actual: string, expected?: string): void {
  if (BigInt(actual) >= 9_223_372_036_854_775_807n)
    throw new DomainError(
      'INVALID_TRANSITION',
      'The local revision sequence reached its storage limit. Preserve this record and create a replacement revision.',
    );
  if (expected !== undefined && actual !== expected)
    throw new DomainError('REVISION_CONFLICT', 'This record changed. Reload before submitting.');
}
export async function balance(
  db: SqlExecutor,
  scope: string,
  lotId: string,
  custody = 'stores',
  reference?: string,
): Promise<bigint> {
  const rows = await db.all(
    `SELECT quantity FROM ledger WHERE workspace_id=? AND lot_id=? AND custody=?${reference ? ' AND reference_id=?' : ''}`,
    [scope, lotId, custody, ...(reference ? [reference] : [])],
  );
  return rows.reduce((sum, row) => {
    const value = text(row, 'quantity');
    return sum + (value.startsWith('-') ? -scaled(value.slice(1)) : scaled(value));
  }, 0n);
}
export async function reserved(db: SqlExecutor, scope: string, lotId: string): Promise<bigint> {
  const rows = await db.all(
    "SELECT quantity FROM reservations WHERE workspace_id=? AND lot_id=? AND state='active'",
    [scope, lotId],
  );
  return rows.reduce((sum, row) => sum + scaled(text(row, 'quantity')), 0n);
}
export async function assertAvailable(
  db: SqlExecutor,
  scope: string,
  lotId: string,
  quantity: string,
): Promise<void> {
  const lot = await getLot(db, scope, lotId);
  if (text(lot, 'qc_state') !== 'released')
    throw new DomainError(
      'LOT_QC_HOLD',
      'This lot is on QC hold. A current inspection and release are required.',
    );
  if (scaled(quantity) > (await balance(db, scope, lotId)) - (await reserved(db, scope, lotId)))
    throw new DomainError(
      'INSUFFICIENT_AVAILABLE_STOCK',
      'Quantity exceeds released, unreserved stock.',
    );
}
export async function event(
  db: SqlExecutor,
  scope: string,
  lotId: string,
  quantity: bigint,
  custody: string,
  reference: string,
  name: string,
): Promise<void> {
  await db.run(
    'INSERT INTO ledger(id,workspace_id,lot_id,quantity,custody,reference_id,event,created_at) VALUES(?,?,?,?,?,?,?,?)',
    [uuid(), scope, lotId, decimal(quantity), custody, reference, name, now()],
  );
}
export async function move(
  db: SqlExecutor,
  scope: string,
  lotId: string,
  quantity: bigint,
  from: string,
  to: string,
  reference: string,
  name: string,
): Promise<void> {
  await event(db, scope, lotId, -quantity, from, reference, name);
  await event(db, scope, lotId, quantity, to, reference, name);
}
export async function bumpLot(db: SqlExecutor, scope: string, id: string): Promise<void> {
  await getLot(db, scope, id);
  await db.run('UPDATE lots SET revision=revision+1 WHERE workspace_id=? AND id=?', [scope, id]);
}
export async function insertLot(
  db: SqlExecutor,
  scope: string,
  itemId: string,
  location: string,
): Promise<{ id: string; code: string }> {
  const id = uuid();
  const count = (
    await db.all('SELECT COUNT(*) AS count FROM lots WHERE workspace_id=?', [scope])
  )[0];
  const code = `LOT-${(BigInt(count?.count ?? 0) + 1n).toString().padStart(5, '0')}`;
  await db.run(
    "INSERT INTO lots(id,workspace_id,code,item_id,location,qc_state) VALUES(?,?,?,?,?,'held')",
    [id, scope, code, itemId, location],
  );
  return { id, code };
}
