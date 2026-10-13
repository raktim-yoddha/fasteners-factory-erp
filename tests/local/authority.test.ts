import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DesktopSqlDriver } from '../../packages/sqlite-desktop/src';
import { initialize, LocalRepository } from '../../packages/local-domain/src';
import { commit, createSampleWorkspace } from '../../packages/test-fixtures/src';
import { request } from '../../packages/application/src';
import type { Authority } from '../../packages/contracts/src';

const resources: { driver: DesktopSqlDriver; directory: string }[] = [];
afterEach(async () => {
  for (const entry of resources.splice(0)) {
    try {
      await entry.driver.close();
    } catch {
      /* Test may already have closed the driver. */
    }
    if (!resolve(entry.directory).startsWith(resolve(tmpdir(), 'fasteners-tests-')))
      throw new Error('Unsafe test cleanup path.');
    await rm(entry.directory, { recursive: true, force: true });
  }
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'fasteners-tests-'));
  const filename = join(directory, 'test.sqlite3');
  const driver = new DesktopSqlDriver(filename);
  resources.push({ driver, directory });
  await initialize(driver);
  const repository = new LocalRepository(driver);
  const workspace = await createSampleWorkspace(repository);
  const authority: Authority = { kind: 'solo', workspaceId: workspace.id };
  return { driver, repository, authority, filename };
}
async function release(repository: LocalRepository, authority: Authority, lotId: string) {
  await commit(repository, authority, 'record_inspection', {
    lotId,
    lower: '0',
    upper: '2',
    readings: ['1', '1.5'],
    unit: 'pcs',
  });
  await commit(repository, authority, 'release_lot', { lotId });
}
describe('SQLite authority', () => {
  it('persists committed records after reopening the database', async () => {
    const { driver, repository, authority, filename } = await setup();
    const before = await repository.snapshot(authority);
    expect(before.audit.find((event) => event.command === 'receive_goods')!.reason).toBe(
      'Supplier reference: SAMPLE-HEAT-A',
    );
    await driver.close();
    const reopened = new DesktopSqlDriver(filename);
    resources[0]!.driver = reopened;
    await initialize(reopened);
    const after = await new LocalRepository(reopened).snapshot(authority);
    expect(after.records).toEqual(before.records);
    expect(after.lots).toEqual(before.lots);
    expect(after.audit).toEqual(before.audit);
  });
  it('does not reserve held receipts and rolls back domain/audit/idempotency together', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const result = await repository.execute(
      request(authority, 'reserve_stock', {
        lotId: before.lots[0]!.id,
        orderId: before.records.find((r) => r.kind === 'sales_order')!.id,
        quantity: '10',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('LOT_QC_HOLD');
    const after = await repository.snapshot(authority);
    expect(after.audit).toEqual(before.audit);
    expect(after.reservations).toEqual(before.reservations);
  });
  it('retries the same request once and rejects changed payload reuse', async () => {
    const { repository, authority } = await setup();
    const initial = await repository.snapshot(authority);
    const command = request(authority, 'receive_goods', {
      itemId: initial.lots[0]!.itemId,
      quantity: '0.1',
      location: 'A',
      supplierReference: 'SAMPLE',
    });
    const first = await repository.execute(command);
    expect(await repository.execute(command)).toEqual(first);
    const changed = await repository.execute({
      ...command,
      payload: { ...command.payload, quantity: '0.2' },
    });
    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect((await repository.snapshot(authority)).lots.length).toBe(2);
  });
  it('serializes competing reservations without overselling', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    await release(repository, authority, lot.id);
    const orderId = before.records.find((r) => r.kind === 'sales_order')!.id;
    const results = await Promise.all([
      repository.execute(
        request(authority, 'reserve_stock', { lotId: lot.id, orderId, quantity: '80' }),
      ),
      repository.execute(
        request(authority, 'reserve_stock', { lotId: lot.id, orderId, quantity: '80' }),
      ),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const after = await repository.snapshot(authority);
    expect(after.lots[0]!.reserved).toBe('80');
    expect(after.lots[0]!.available).toBe('70');
  });
  it('blocks dispatch after a new QC hold and requires a new inspection', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    await release(repository, authority, lot.id);
    const reservationId = await commit(repository, authority, 'reserve_stock', {
      lotId: lot.id,
      orderId: before.records.find((r) => r.kind === 'sales_order')!.id,
      quantity: '20',
    });
    const packageId = await commit(repository, authority, 'verify_packing', {
      reservationId,
      quantity: '20',
      scannedLotCode: lot.code,
    });
    await commit(repository, authority, 'hold_lot', {
      lotId: lot.id,
      reason: 'SAMPLE new containment',
    });
    const rejected = await repository.execute(
      request(authority, 'confirm_dispatch', { packageId, carrier: 'SAMPLE carrier' }),
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('LOT_QC_HOLD');
    const stale = await repository.execute(request(authority, 'release_lot', { lotId: lot.id }));
    expect(stale.ok).toBe(false);
    await release(repository, authority, lot.id);
    await commit(repository, authority, 'confirm_dispatch', {
      packageId,
      carrier: 'SAMPLE carrier',
    });
    const after = await repository.snapshot(authority);
    expect(after.lots[0]!.onHand).toBe('130');
    expect(after.records.find((r) => r.kind === 'sales_order')!.state).toBe('partially_fulfilled');
  });
  it('rejects excessive customer returns and creates held return stock', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    await release(repository, authority, lot.id);
    const reservationId = await commit(repository, authority, 'reserve_stock', {
      lotId: lot.id,
      orderId: before.records.find((r) => r.kind === 'sales_order')!.id,
      quantity: '20',
    });
    const packageId = await commit(repository, authority, 'verify_packing', {
      reservationId,
      quantity: '20',
      scannedLotCode: lot.code,
    });
    const shipmentId = await commit(repository, authority, 'confirm_dispatch', {
      packageId,
      carrier: 'SAMPLE carrier',
    });
    await commit(repository, authority, 'receive_customer_return', {
      shipmentId,
      quantity: '15',
      reason: 'SAMPLE return',
    });
    const invalid = await repository.execute(
      request(authority, 'receive_customer_return', {
        shipmentId,
        quantity: '6',
        reason: 'SAMPLE over-return',
      }),
    );
    expect(invalid.ok).toBe(false);
    expect((await repository.snapshot(authority)).lots[0]!.qcState).toBe('held');
  });
  it('rejects stale revisions, foreign workspace references and team authority', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    const stale = await repository.execute(
      request(authority, 'hold_lot', { lotId: lot.id, reason: 'SAMPLE hold' }, '999'),
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('REVISION_CONFLICT');
    const other = await repository.createWorkspace({
      name: 'SAMPLE B',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    });
    const foreign = await repository.execute(
      request({ kind: 'solo', workspaceId: other.id }, 'hold_lot', {
        lotId: lot.id,
        reason: 'SAMPLE foreign',
      }),
    );
    expect(foreign.ok).toBe(false);
    const team = await repository.execute(
      request({ kind: 'team', companyId: crypto.randomUUID() }, 'hold_lot', {
        lotId: lot.id,
        reason: 'SAMPLE team',
      }),
    );
    expect(team.ok).toBe(false);
    if (!team.ok) expect(team.error.code).toBe('COMPANY_SCOPE_MISMATCH');
  });
  it('prevents direct ledger and approved engineering modification', async () => {
    const { driver, repository, authority } = await setup();
    await expect(driver.run("UPDATE ledger SET quantity='999'")).rejects.toThrow('append-only');
    const engineering = (await repository.snapshot(authority)).records.find(
      (r) => r.kind === 'engineering',
    )!;
    await expect(
      driver.run('UPDATE records SET name=? WHERE id=?', ['tampered', engineering.id]),
    ).rejects.toThrow('immutable');
  });
  it('freezes item interpretation after references while allowing a display correction', async () => {
    const { repository, authority } = await setup();
    const item = (await repository.snapshot(authority)).records.find((row) => row.kind === 'item')!;
    const rejected = await repository.execute(
      request(
        authority,
        'save_record',
        {
          kind: 'item',
          id: item.id,
          code: item.code,
          name: item.name,
          fields: { ...item.fields, unit: 'kg' },
        },
        item.revision,
      ),
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('INVALID_TRANSITION');
    await commit(
      repository,
      authority,
      'save_record',
      {
        kind: 'item',
        id: item.id,
        code: item.code,
        name: 'SAMPLE corrected label',
        fields: item.fields,
      },
      item.revision,
    );
    expect((await repository.snapshot(authority)).lots[0]!.unit).toBe('pcs');
  });
  it('accepts decimal-equivalent order quantity against an approved quote', async () => {
    const { repository, authority } = await setup();
    const order = (await repository.snapshot(authority)).records.find(
      (row) => row.kind === 'sales_order',
    )!;
    const id = await commit(repository, authority, 'save_record', {
      kind: 'sales_order',
      code: 'SAMPLE-SO-EXACT',
      name: 'SAMPLE exact order',
      fields: { ...order.fields, quantity: '100.000000' },
    });
    await commit(repository, authority, 'transition_record', { id, state: 'accepted' });
    expect((await repository.snapshot(authority)).records.find((row) => row.id === id)!.state).toBe(
      'accepted',
    );
  });
  it('keeps NCR containment when text claims physical disposition', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    const id = await commit(repository, authority, 'save_record', {
      kind: 'ncr',
      code: 'SAMPLE-NCR',
      name: 'SAMPLE containment',
      fields: {
        lotId: lot.id,
        quantity: '1',
        defect: 'SAMPLE defect',
        disposition: 'SAMPLE text claim',
      },
    });
    await commit(repository, authority, 'transition_record', {
      id,
      state: 'awaiting_execution',
      reason: 'SAMPLE proposed disposition',
    });
    const rejected = await repository.execute(
      request(authority, 'transition_record', {
        id,
        state: 'closed',
        reason: 'SAMPLE claimed execution',
      }),
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('INVALID_TRANSITION');
    await commit(repository, authority, 'record_inspection', {
      lotId: lot.id,
      lower: '0',
      upper: '2',
      readings: ['1'],
      unit: 'pcs',
    });
    const release = await repository.execute(request(authority, 'release_lot', { lotId: lot.id }));
    expect(release.ok).toBe(false);
    expect((await repository.snapshot(authority)).lots[0]!.qcState).toBe('held');
  });
  it('reconciles actual vendor custody rather than treating historical events as open balances', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    const supplierId = before.records.find((row) => row.kind === 'supplier')!.id;
    const job = await commit(repository, authority, 'save_record', {
      kind: 'jobwork',
      code: 'SAMPLE-JW',
      name: 'SAMPLE jobwork',
      fields: { supplierId, itemId: lot.itemId, quantity: '10', dueDate: '2026-12-01' },
    });
    await commit(repository, authority, 'transition_record', { id: job, state: 'open' });
    await release(repository, authority, lot.id);
    await commit(repository, authority, 'send_jobwork', {
      lotId: lot.id,
      supplierId,
      quantity: '10',
    });
    expect(
      (
        await repository.execute(
          request(authority, 'transition_record', { id: job, state: 'closed' }),
        )
      ).ok,
    ).toBe(false);
    await commit(repository, authority, 'receive_jobwork', {
      lotId: lot.id,
      supplierId,
      quantity: '9',
      loss: '1',
      reason: 'SAMPLE recorded loss',
    });
    await commit(repository, authority, 'transition_record', { id: job, state: 'closed' });
    const after = await repository.snapshot(authority);
    expect(after.lots.find((row) => row.id === lot.id)!.vendor).toBe('0');
    expect(after.lots.find((row) => row.id !== lot.id)!.qcState).toBe('held');
  });
  it('rejects unreconciled production output without partial ledger or audit writes', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const result = await repository.execute(
      request(authority, 'record_production_output', {
        workOrderId: crypto.randomUUID(),
        itemId: before.lots[0]!.itemId,
        quantity: '10',
        scrap: '0',
        location: 'SAMPLE',
      }),
    );
    expect(result.ok).toBe(false);
    const after = await repository.snapshot(authority);
    expect(after.lots).toEqual(before.lots);
    expect(after.audit).toEqual(before.audit);
  });
  it('cannot move existing NCR containment to a different released lot', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    const target = await commit(repository, authority, 'receive_goods', {
      itemId: lot.itemId,
      quantity: '5',
      location: 'SAMPLE another lot',
      supplierReference: 'SAMPLE',
    });
    await release(repository, authority, target);
    const fields = { lotId: lot.id, quantity: '1', defect: 'SAMPLE defect' };
    const id = await commit(repository, authority, 'save_record', {
      kind: 'ncr',
      code: 'SAMPLE-CONTAIN',
      name: 'SAMPLE containment',
      fields,
    });
    const state = await repository.snapshot(authority);
    const ncr = state.records.find((row) => row.id === id)!;
    const rejected = await repository.execute(
      request(
        authority,
        'save_record',
        { kind: 'ncr', id, code: ncr.code, name: ncr.name, fields: { ...fields, lotId: target } },
        ncr.revision,
      ),
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('INVALID_TRANSITION');
    const after = await repository.snapshot(authority);
    expect(after.records.find((row) => row.id === id)!.fields.lotId).toBe(lot.id);
    expect(after.audit).toEqual(state.audit);
  });
  it('does not mistake historical issue events for actual remaining work custody', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const lot = before.lots[0]!;
    const order = before.records.find((row) => row.kind === 'sales_order')!;
    const equipment = before.records.find((row) => row.kind === 'equipment')!;
    const id = await commit(repository, authority, 'save_record', {
      kind: 'work_order',
      code: 'SAMPLE-WO',
      name: 'SAMPLE custody work',
      fields: {
        orderId: order.id,
        engineeringId: order.fields.engineeringId!,
        itemId: lot.itemId,
        quantity: '10',
        equipmentId: equipment.id,
      },
    });
    await commit(repository, authority, 'transition_record', { id, state: 'released' });
    await release(repository, authority, lot.id);
    await commit(repository, authority, 'issue_material', {
      lotId: lot.id,
      workOrderId: id,
      quantity: '10',
    });
    await commit(repository, authority, 'return_material', {
      lotId: lot.id,
      workOrderId: id,
      quantity: '10',
    });
    const result = await repository.execute(
      request(authority, 'transition_record', { id, state: 'in_progress' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
    const after = await repository.snapshot(authority);
    expect(after.lots.find((row) => row.id === lot.id)!.wip).toBe('0');
    expect(after.lots.find((row) => row.id !== lot.id)!.qcState).toBe('held');
    await commit(repository, authority, 'transition_record', { id, state: 'cancelled' });
  });
  it('keeps material consumption disabled until production can be reconciled', async () => {
    const { repository, authority } = await setup();
    const before = await repository.snapshot(authority);
    const result = await repository.execute(
      request(authority, 'consume_material', {
        lotId: before.lots[0]!.id,
        workOrderId: crypto.randomUUID(),
        quantity: '1',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('complete approved production');
    const after = await repository.snapshot(authority);
    expect(after.audit).toEqual(before.audit);
    expect(after.lots).toEqual(before.lots);
  });

  it('keeps revisions above the safe-number range exact and rejects integer overflow atomically', async () => {
    const { driver, repository, authority } = await setup();
    const lot = (await repository.snapshot(authority)).lots[0]!;
    await driver.run('UPDATE lots SET revision=? WHERE id=?', ['9007199254740993', lot.id]);
    expect((await repository.snapshot(authority)).lots[0]!.revision).toBe('9007199254740993');
    await commit(
      repository,
      authority,
      'record_inspection',
      { lotId: lot.id, lower: '0', upper: '2', readings: ['1'], unit: 'pcs' },
      '9007199254740993',
    );
    await commit(repository, authority, 'release_lot', { lotId: lot.id }, '9007199254740994');
    expect((await repository.snapshot(authority)).lots[0]!.revision).toBe('9007199254740995');
    await driver.run('UPDATE lots SET revision=? WHERE id=?', ['9223372036854775807', lot.id]);
    const before = await repository.snapshot(authority);
    const result = await repository.execute(
      request(
        authority,
        'hold_lot',
        { lotId: lot.id, reason: 'SAMPLE overflow' },
        '9223372036854775807',
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
    const after = await repository.snapshot(authority);
    expect(after.lots).toEqual(before.lots);
    expect(after.audit).toEqual(before.audit);
  });
});
