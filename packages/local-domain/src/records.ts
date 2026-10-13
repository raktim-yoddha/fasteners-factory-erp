import { DomainError, recordFields, type CommandRequest } from '@fasteners/contracts';
import { assertTransition, initialState, isImmutable, positive, scaled } from '@fasteners/domain';
import type { SqlExecutor } from '@fasteners/sqlite-schema';
import { balance, checkRevision, getLot, getRecord, now, text, uuid } from './database';

export async function saveRecord(
  db: SqlExecutor,
  scope: string,
  request: Extract<CommandRequest, { command: 'save_record' }>,
): Promise<string> {
  const { payload } = request;
  const allowed = recordFields[payload.kind];
  if (Object.keys(payload.fields).some((key) => !allowed.some((field) => field.key === key)))
    throw new DomainError('INVALID_INPUT', 'Unsupported record field.');
  for (const field of allowed) {
    const value = payload.fields[field.key];
    if (field.required && !value?.trim())
      throw new DomainError('INVALID_INPUT', `${field.label} is required.`);
    if (!value) continue;
    if (field.type === 'decimal') {
      scaled(value);
      if (field.key === 'quantity' || field.key === 'outputBasis') positive(value);
    } else if (field.type === 'date') {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
      )
        throw new DomainError('INVALID_INPUT', 'Use a valid date.');
    } else if (field.type === 'lot') await getLot(db, scope, value);
    else if (field.type !== 'text') await getRecord(db, scope, value, field.type);
  }
  if (payload.id) {
    const previous = await getRecord(db, scope, payload.id, payload.kind);
    checkRevision(previous.revision, request.expectedRevision);
    if (isImmutable(previous.kind, previous.state))
      throw new DomainError(
        'INVALID_TRANSITION',
        'Approved or active business revisions cannot be overwritten. Create a replacement revision.',
      );
    if (payload.kind === 'ncr' && previous.fields.lotId !== payload.fields.lotId)
      throw new DomainError(
        'INVALID_TRANSITION',
        'NCR containment cannot be moved to a different lot. Create a separately contained NCR.',
      );
    if (
      payload.kind === 'item' &&
      ['unit', 'grade', 'finish'].some(
        (key) => (previous.fields[key] ?? '') !== (payload.fields[key] ?? ''),
      )
    ) {
      const referenced = await db.all(
        "SELECT id FROM lots WHERE workspace_id=? AND item_id=? UNION ALL SELECT id FROM records WHERE workspace_id=? AND id<>? AND json_extract(fields,'$.itemId')=? LIMIT 1",
        [scope, payload.id, scope, payload.id, payload.id],
      );
      if (referenced.length)
        throw new DomainError(
          'INVALID_TRANSITION',
          'Referenced item units, grade and finish are immutable. Create a new item revision.',
        );
    }
    await db.run(
      'UPDATE records SET code=?,name=?,fields=?,revision=revision+1 WHERE workspace_id=? AND id=?',
      [payload.code, payload.name, JSON.stringify(payload.fields), scope, payload.id],
    );
    return payload.id;
  }
  const id = uuid();
  await db.run(
    'INSERT INTO records(id,workspace_id,kind,code,name,state,fields,created_at) VALUES(?,?,?,?,?,?,?,?)',
    [
      id,
      scope,
      payload.kind,
      payload.code,
      payload.name,
      initialState(payload.kind),
      JSON.stringify(payload.fields),
      now(),
    ],
  );
  if (payload.kind === 'ncr')
    await db.run(
      "UPDATE lots SET qc_state='held',revision=revision+1 WHERE workspace_id=? AND id=?",
      [scope, payload.fields.lotId ?? ''],
    );
  return id;
}
export async function transitionRecord(
  db: SqlExecutor,
  scope: string,
  request: Extract<CommandRequest, { command: 'transition_record' }>,
): Promise<string> {
  const record = await getRecord(db, scope, request.payload.id);
  checkRevision(record.revision, request.expectedRevision);
  assertTransition(record.kind, record.state, request.payload.state);
  const { fields } = record;
  const next = request.payload.state;
  if (record.kind === 'engineering' && next === 'approved') {
    if (!fields.route || !fields.drawingReference)
      throw new DomainError(
        'INVALID_INPUT',
        'Engineering needs a drawing revision and operation sequence.',
      );
  }
  if (record.kind === 'quotation' && next === 'approved') {
    const engineering = await getRecord(db, scope, fields.engineeringId ?? '', 'engineering');
    if (engineering.state !== 'approved')
      throw new DomainError(
        'INVALID_TRANSITION',
        'Approve engineering before approving this quotation.',
      );
  }
  if (record.kind === 'sales_order' && next === 'accepted') {
    const engineering = await getRecord(db, scope, fields.engineeringId ?? '', 'engineering');
    const quote = await getRecord(db, scope, fields.quotationId ?? '', 'quotation');
    if (engineering.state !== 'approved' || !['approved', 'sent', 'accepted'].includes(quote.state))
      throw new DomainError(
        'INVALID_TRANSITION',
        'Current approved engineering and quotation are required.',
      );
    if (fields.poDiscrepancies?.trim())
      throw new DomainError(
        'INVALID_TRANSITION',
        'Resolve the customer PO discrepancies before acceptance.',
      );
    if (
      quote.fields.engineeringId !== engineering.id ||
      quote.fields.customerId !== fields.customerId ||
      engineering.fields.itemId !== fields.itemId ||
      scaled(quote.fields.quantity ?? '0') !== scaled(fields.quantity ?? '0')
    )
      throw new DomainError(
        'INVALID_INPUT',
        'Customer, item, quantity and engineering must match the approved quotation.',
      );
  }
  if (record.kind === 'sales_order' && ['closed', 'cancelled'].includes(next)) {
    const active = await db.all(
      "SELECT id FROM reservations WHERE workspace_id=? AND order_id=? AND state='active'",
      [scope, record.id],
    );
    const work = await db.all(
      "SELECT id FROM records WHERE workspace_id=? AND kind='work_order' AND json_extract(fields,'$.orderId')=? AND state NOT IN ('closed','cancelled')",
      [scope, record.id],
    );
    if (active.length || work.length)
      throw new DomainError(
        'INVALID_TRANSITION',
        'Reconcile active reservations and work orders first.',
      );
    if (next === 'closed' && record.state !== 'fulfilled')
      throw new DomainError('INVALID_TRANSITION', 'Fulfil this order before closing.');
    if (
      next === 'cancelled' &&
      (
        await db.all('SELECT id FROM shipments WHERE workspace_id=? AND order_id=?', [
          scope,
          record.id,
        ])
      ).length
    )
      throw new DomainError(
        'INVALID_TRANSITION',
        'Dispatched obligations require a controlled amendment, not cancellation.',
      );
  }
  if (
    record.kind === 'purchase_order' &&
    ['cancelled', 'closed'].includes(next) &&
    record.state === 'partial_receipt'
  )
    throw new DomainError(
      'INVALID_TRANSITION',
      'Reconcile the remaining purchase obligation before closure.',
    );
  if (record.kind === 'work_order' && ['released', 'in_progress'].includes(next)) {
    const engineering = await getRecord(db, scope, fields.engineeringId ?? '', 'engineering');
    const order = await getRecord(db, scope, fields.orderId ?? '', 'sales_order');
    if (
      engineering.state !== 'approved' ||
      !['accepted', 'partially_fulfilled'].includes(order.state) ||
      order.fields.engineeringId !== engineering.id ||
      fields.itemId !== engineering.fields.itemId
    )
      throw new DomainError(
        'INVALID_TRANSITION',
        'Work requires current accepted demand and matching approved engineering.',
      );
    const equipment = await getRecord(db, scope, fields.equipmentId ?? '', 'equipment');
    if (equipment.state !== 'ready' || (equipment.fields.calibrationDue ?? '') < now().slice(0, 10))
      throw new DomainError(
        'EQUIPMENT_NOT_READY',
        'Equipment is unavailable or calibration has expired.',
      );
    if (next === 'in_progress') {
      const issued = await db.all(
        "SELECT DISTINCT lot_id FROM ledger WHERE workspace_id=? AND reference_id=? AND custody='wip'",
        [scope, record.id],
      );
      let hasActualMaterial = false;
      for (const lot of issued)
        if ((await balance(db, scope, text(lot, 'lot_id'), 'wip', record.id)) > 0n)
          hasActualMaterial = true;
      if (!hasActualMaterial)
        throw new DomainError(
          'INVALID_TRANSITION',
          'Issue actual remaining material before starting or resuming work.',
        );
    }
  }
  if (record.kind === 'work_order' && ['completed', 'closed', 'cancelled'].includes(next)) {
    const lots = await db.all(
      'SELECT DISTINCT lot_id FROM ledger WHERE workspace_id=? AND reference_id=?',
      [scope, record.id],
    );
    for (const lot of lots)
      if ((await balance(db, scope, text(lot, 'lot_id'), 'wip', record.id)) !== 0n)
        throw new DomainError(
          'INVALID_TRANSITION',
          'Reconcile all work-in-progress material before closure.',
        );
    const outputs = await db.all(
      "SELECT quantity FROM ledger WHERE workspace_id=? AND reference_id=? AND event='production_output'",
      [scope, record.id],
    );
    const output = outputs.reduce((sum, row) => sum + scaled(text(row, 'quantity')), 0n);
    if (next !== 'cancelled' && output < scaled(fields.quantity ?? '0'))
      throw new DomainError(
        'INVALID_TRANSITION',
        'Record all planned output before completing work.',
      );
    if (next === 'cancelled' && output > 0n)
      throw new DomainError('INVALID_TRANSITION', 'Produced work cannot be cancelled.');
  }
  if (record.kind === 'ncr') {
    if (!request.payload.reason?.trim())
      throw new DomainError('INVALID_INPUT', 'Disposition and execution need a recorded reason.');
    if (next === 'closed')
      throw new DomainError(
        'INVALID_TRANSITION',
        'NCR closure awaits verified physical disposition and independent review. Text evidence cannot release containment.',
      );
  }
  if (record.kind === 'jobwork' && next === 'closed') {
    const lots = await db.all(
      "SELECT DISTINCT lot_id FROM ledger WHERE workspace_id=? AND reference_id=? AND custody='vendor'",
      [scope, fields.supplierId ?? ''],
    );
    for (const lot of lots)
      if ((await balance(db, scope, text(lot, 'lot_id'), 'vendor', fields.supplierId)) !== 0n)
        throw new DomainError(
          'INVALID_TRANSITION',
          'Vendor custody must be explicitly reconciled before closure.',
        );
  }
  await db.run('UPDATE records SET state=?,revision=revision+1 WHERE workspace_id=? AND id=?', [
    next,
    scope,
    record.id,
  ]);
  return record.id;
}
