import {
  commandPayloads,
  commandResultSchema,
  DomainError,
  identifierSchema,
  parseCommand,
  recordFields,
  workspaceSchema,
  type BusinessRecord,
  type Workspace,
} from '@fasteners/contracts';
import { scaled, transitions } from '@fasteners/domain';
import type { SqlExecutor, SqlRow } from '@fasteners/sqlite-schema';
import { mapRecord, text } from './database';

const key = (scope: string, id: string) => `${scope}:${id}`;
function requireValid(condition: boolean, reason: string): asserts condition {
  if (!condition) throw new DomainError('BACKUP_INVALID', `Restore validation failed: ${reason}.`);
}
function revision(value: string) {
  requireValid(
    /^[1-9]\d*$/.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n,
    'invalid exact revision',
  );
}
function amount(value: string, positive = true): bigint {
  const valueScaled = value.startsWith('-') ? -scaled(value.slice(1)) : scaled(value);
  if (positive) requireValid(valueScaled > 0n, 'quantity must be positive');
  return valueScaled;
}
function add(map: Map<string, bigint>, id: string, value: bigint) {
  map.set(id, (map.get(id) ?? 0n) + value);
}

/** Called only after the platform has allowlisted the complete SQLite schema. */
export async function validateRecoveryData(db: SqlExecutor): Promise<{
  workspaces: Workspace[];
  counts: { records: string; lots: string; ledger: string; audit: string };
}> {
  const workspaces = (await db.all('SELECT * FROM workspaces ORDER BY created_at,id')).map(
    (row) => {
      const workspace = workspaceSchema.parse({
        id: row.id,
        name: row.name,
        currency: row.currency,
        timezone: row.timezone,
        createdAt: row.created_at,
      });
      requireValid(
        workspace.name.trim().length > 0 && workspace.name.length <= 120,
        'workspace name',
      );
      new Intl.DateTimeFormat('en', { timeZone: workspace.timezone });
      requireValid(!Number.isNaN(Date.parse(workspace.createdAt)), 'workspace date');
      return workspace;
    },
  );
  const scopes = new Set(workspaces.map((workspace) => workspace.id));
  const records = new Map<string, BusinessRecord>();
  for (const row of await db.all('SELECT * FROM records')) {
    const scope = text(row, 'workspace_id');
    requireValid(scopes.has(scope), 'record workspace');
    const record = mapRecord(row);
    parseCommand({
      contractVersion: 1,
      command: 'save_record',
      authority: { kind: 'solo', workspaceId: scope },
      idempotencyKey: record.id,
      payload: {
        id: record.id,
        kind: record.kind,
        code: record.code,
        name: record.name,
        fields: record.fields,
      },
    });
    revision(record.revision);
    requireValid(Object.hasOwn(transitions[record.kind], record.state), 'record state');
    requireValid(!Number.isNaN(Date.parse(record.createdAt)), 'record date');
    records.set(key(scope, record.id), record);
  }
  const lots = new Map<string, SqlRow>();
  for (const row of await db.all('SELECT * FROM lots')) {
    identifierSchema.parse(row.id);
    const scope = text(row, 'workspace_id');
    requireValid(
      scopes.has(scope) && records.get(key(scope, text(row, 'item_id')))?.kind === 'item',
      'lot item scope',
    );
    requireValid(['held', 'released'].includes(text(row, 'qc_state')), 'lot QC state');
    revision(text(row, 'revision'));
    lots.set(key(scope, text(row, 'id')), row);
  }
  for (const [recordKey, record] of records) {
    const scope = recordKey.slice(0, 36);
    const allowed = recordFields[record.kind];
    requireValid(
      Object.keys(record.fields).every((field) =>
        allowed.some((definition) => definition.key === field),
      ),
      'record fields',
    );
    for (const field of allowed) {
      const value = record.fields[field.key];
      requireValid(!field.required || Boolean(value?.trim()), 'required field');
      if (!value) continue;
      if (field.type === 'decimal') {
        scaled(value);
        amount(value, field.key === 'quantity' || field.key === 'outputBasis');
      } else if (field.type === 'date')
        requireValid(
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
            new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
          'date field',
        );
      else if (field.type === 'lot') requireValid(lots.has(key(scope, value)), 'lot reference');
      else if (field.type !== 'text')
        requireValid(
          records.get(key(scope, value))?.kind === field.type,
          'record reference scope and kind',
        );
    }
    if (record.kind === 'ncr' && record.state !== 'closed')
      requireValid(
        lots.get(key(scope, record.fields.lotId!))?.qc_state === 'held',
        'NCR containment',
      );
  }
  const ledger = await db.all('SELECT * FROM ledger');
  const balances = new Map<string, bigint>();
  const referenceBalances = new Map<string, bigint>();
  const itemTotals = new Map<string, bigint>();
  const itemReceipts = new Map<string, bigint>();
  const returnedByShipment = new Map<string, bigint>();
  const events = new Set([
    'goods_receipt',
    'material_issue',
    'material_return',
    'transfer_out',
    'transfer_in',
    'vendor_outward',
    'vendor_return',
    'vendor_loss',
    'dispatch',
    'customer_return',
    'customer_return_custody',
  ]);
  for (const row of ledger) {
    identifierSchema.parse(row.id);
    const scope = text(row, 'workspace_id');
    const lotKey = key(scope, text(row, 'lot_id'));
    const lot = lots.get(lotKey);
    requireValid(Boolean(lot), 'ledger lot scope');
    requireValid(typeof row.quantity === 'string', 'ledger exact text');
    const quantity = amount(text(row, 'quantity'), false);
    requireValid(quantity !== 0n && events.has(text(row, 'event')), 'ledger event');
    const custody = text(row, 'custody');
    requireValid(
      ['stores', 'wip', 'vendor', 'shipped', 'loss'].includes(custody),
      'supported custody',
    );
    const reference = text(row, 'reference_id');
    identifierSchema.parse(reference);
    if (custody === 'wip')
      requireValid(
        records.get(key(scope, reference))?.kind === 'work_order',
        'work custody reference',
      );
    if (custody === 'vendor')
      requireValid(
        records.get(key(scope, reference))?.kind === 'supplier',
        'vendor custody reference',
      );
    add(balances, `${lotKey}:${custody}`, quantity);
    add(referenceBalances, `${lotKey}:${custody}:${reference}`, quantity);
    const itemKey = key(scope, text(lot!, 'item_id'));
    add(itemTotals, itemKey, quantity);
    if (row.event === 'goods_receipt') {
      requireValid(quantity > 0n && custody === 'stores', 'receipt custody');
      add(itemReceipts, itemKey, quantity);
    }
    if (row.event === 'customer_return') {
      requireValid(quantity > 0n && custody === 'stores', 'return custody');
      add(returnedByShipment, key(scope, reference), quantity);
    }
  }
  for (const quantity of balances.values())
    requireValid(quantity >= 0n, 'negative physical custody');
  for (const [id, quantity] of referenceBalances)
    if (/:wip:|:vendor:|:shipped:/.test(id))
      requireValid(quantity >= 0n, 'negative referenced custody');
  for (const [id, quantity] of itemTotals)
    requireValid(quantity === (itemReceipts.get(id) ?? 0n), 'item conservation');

  const reservations = new Map<string, SqlRow>();
  const allocated = new Map<string, bigint>();
  const reservedByLot = new Map<string, bigint>();
  for (const row of await db.all('SELECT * FROM reservations')) {
    identifierSchema.parse(row.id);
    const scope = text(row, 'workspace_id');
    const lotKey = key(scope, text(row, 'lot_id'));
    const orderKey = key(scope, text(row, 'order_id'));
    const order = records.get(orderKey);
    requireValid(
      order?.kind === 'sales_order' && order.fields.itemId === lots.get(lotKey)?.item_id,
      'reservation order/item scope',
    );
    const quantity = amount(text(row, 'quantity'));
    requireValid(
      ['active', 'released', 'dispatched'].includes(text(row, 'state')),
      'reservation state',
    );
    if (row.state !== 'released') add(allocated, orderKey, quantity);
    if (row.state === 'active') add(reservedByLot, lotKey, quantity);
    reservations.set(key(scope, text(row, 'id')), row);
  }
  for (const [id, quantity] of reservedByLot)
    requireValid(
      quantity <= (balances.get(`${id}:stores`) ?? 0n),
      'reservations exceed physical stock',
    );
  for (const [id, quantity] of allocated)
    requireValid(
      quantity <= amount(records.get(id)!.fields.quantity!),
      'allocations exceed accepted demand',
    );
  const packages = new Map<string, SqlRow>();
  const packedReservations = new Set<string>();
  for (const row of await db.all('SELECT * FROM packages')) {
    identifierSchema.parse(row.id);
    const scope = text(row, 'workspace_id');
    const reservationKey = key(scope, text(row, 'reservation_id'));
    const reservation = reservations.get(reservationKey);
    requireValid(
      Boolean(reservation) && !packedReservations.has(reservationKey),
      'unique package reservation',
    );
    requireValid(
      row.lot_id === reservation!.lot_id &&
        row.order_id === reservation!.order_id &&
        amount(text(row, 'quantity')) === amount(text(reservation!, 'quantity')),
      'package reconciliation',
    );
    requireValid(
      (row.state === 'verified' && reservation!.state === 'active') ||
        (row.state === 'dispatched' && reservation!.state === 'dispatched'),
      'package/reservation state',
    );
    packedReservations.add(reservationKey);
    packages.set(key(scope, text(row, 'id')), row);
  }
  const dispatchedPackages = new Set<string>();
  for (const row of await db.all('SELECT * FROM shipments')) {
    identifierSchema.parse(row.id);
    const scope = text(row, 'workspace_id');
    const packageKey = key(scope, text(row, 'package_id'));
    const packed = packages.get(packageKey);
    requireValid(
      packed?.state === 'dispatched' &&
        row.lot_id === packed.lot_id &&
        row.order_id === packed.order_id &&
        amount(text(row, 'quantity')) === amount(text(packed, 'quantity')),
      'shipment package reconciliation',
    );
    const shipmentKey = `${key(scope, text(row, 'lot_id'))}:shipped:${text(row, 'id')}`;
    const returns = returnedByShipment.get(key(scope, text(row, 'id'))) ?? 0n;
    requireValid(
      (referenceBalances.get(shipmentKey) ?? 0n) === amount(text(row, 'quantity')) - returns,
      'shipment/return custody',
    );
    dispatchedPackages.add(packageKey);
  }
  for (const [id, row] of packages)
    requireValid(row.state !== 'dispatched' || dispatchedPackages.has(id), 'missing shipment');
  for (const row of await db.all('SELECT * FROM genealogy')) {
    identifierSchema.parse(row.id);
    const scope = text(row, 'workspace_id');
    const parent = lots.get(key(scope, text(row, 'parent_lot_id')));
    const child = lots.get(key(scope, text(row, 'child_lot_id')));
    requireValid(
      Boolean(parent && child) && parent!.item_id === child!.item_id && parent!.id !== child!.id,
      'genealogy scope and item',
    );
    amount(text(row, 'quantity'));
  }
  const latestInspections = new Map<string, SqlRow>();
  for (const row of await db.all('SELECT * FROM inspections ORDER BY created_at,rowid')) {
    identifierSchema.parse(row.id);
    const lot = lots.get(key(text(row, 'workspace_id'), text(row, 'lot_id')));
    requireValid(Boolean(lot), 'inspection lot');
    revision(text(row, 'lot_revision'));
    const lower = amount(text(row, 'lower_limit'), false),
      upper = amount(text(row, 'upper_limit'), false);
    requireValid(lower >= 0n && upper >= lower, 'inspection limits');
    const readings: unknown = JSON.parse(text(row, 'readings'));
    requireValid(
      Array.isArray(readings) && readings.length > 0 && readings.length <= 100,
      'inspection readings',
    );
    const passed = readings.every(
      (value) =>
        typeof value === 'string' && amount(value, false) >= lower && amount(value, false) <= upper,
    );
    requireValid(
      (Number(row.passed) === 1) === passed &&
        BigInt(text(row, 'lot_revision')) <= BigInt(text(lot!, 'revision')),
      'inspection result',
    );
    latestInspections.set(key(text(row, 'workspace_id'), text(row, 'lot_id')), row);
  }
  for (const [id, lot] of lots)
    if (lot.qc_state === 'released') {
      const inspection = latestInspections.get(id);
      requireValid(
        Boolean(inspection) &&
          Number(inspection!.passed) === 1 &&
          BigInt(text(inspection!, 'lot_revision')) < BigInt(text(lot, 'revision')),
        'released stock evidence',
      );
    }
  const audit = await db.all('SELECT * FROM audit');
  const auditCounts = new Map<string, bigint>();
  for (const row of audit) {
    identifierSchema.parse(row.id);
    identifierSchema.parse(row.entity_id);
    requireValid(
      scopes.has(text(row, 'workspace_id')) &&
        Object.hasOwn(commandPayloads, text(row, 'command')) &&
        Boolean(text(row, 'actor')),
      'audit identity and command',
    );
    add(
      auditCounts,
      `${key(text(row, 'workspace_id'), text(row, 'actor'))}:${text(row, 'command')}:${text(row, 'entity_id')}`,
      1n,
    );
  }
  const outcomes = new Map<string, bigint>();
  for (const row of await db.all('SELECT * FROM idempotency')) {
    identifierSchema.parse(row.request_key);
    const scope = text(row, 'workspace_id');
    const result = commandResultSchema.parse(JSON.parse(text(row, 'result')));
    requireValid(
      result.ok && result.authority.kind === 'solo' && result.authority.workspaceId === scope,
      'cached authority outcome',
    );
    const outcomeKey = `${key(scope, text(row, 'actor'))}:${text(row, 'command')}:${result.value.id}`;
    add(outcomes, outcomeKey, 1n);
    requireValid(
      Object.hasOwn(commandPayloads, text(row, 'command')) && Boolean(text(row, 'fingerprint')),
      'cached command fingerprint',
    );
  }
  requireValid(
    outcomes.size === auditCounts.size &&
      [...outcomes].every(([id, count]) => auditCounts.get(id) === count),
    'audit/idempotency reconciliation',
  );
  return {
    workspaces,
    counts: {
      records: String(records.size),
      lots: String(lots.size),
      ledger: String(ledger.length),
      audit: String(audit.length),
    },
  };
}
