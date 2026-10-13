import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DesktopSqlDriver } from '../../packages/sqlite-desktop/src';
import { initialize, LocalRepository } from '../../packages/local-domain/src';
import { commit, createSampleWorkspace } from '../../packages/test-fixtures/src';
import { ManagedDatabase } from '../../apps/desktop/src/database/managed-database';
import { validateSnapshot } from '../../apps/desktop/src/database/validate-backup';
import { nativeAtomicFileIO, type AtomicFileIO } from '../../apps/desktop/src/shared/atomic-file';
import { LocalRecoveryJournal } from '../../packages/client-storage/src';

const directories: string[] = [];
const resources: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const resource of resources.splice(0)) await resource.close().catch(() => undefined);
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'factory-restore-tests-')))
      throw new Error('Unsafe test cleanup');
    await rm(directory, { recursive: true, force: true });
  }
});
async function folder() {
  const directory = await mkdtemp(join(tmpdir(), 'factory-restore-tests-'));
  directories.push(directory);
  return directory;
}
async function source() {
  const driver = new DesktopSqlDriver(':memory:');
  resources.push(driver);
  await initialize(driver);
  const repository = new LocalRepository(driver, 'local-owner:desktop');
  const workspace = await createSampleWorkspace(repository);
  return { driver, repository, workspace, bytes: await driver.exportDatabase() };
}

it('previews and activates a separate database, preserves old bytes, and resolves the original token after reopening', async () => {
  const donor = await source();
  const directory = await folder();
  const managed = await ManagedDatabase.open(directory);
  resources.push(managed);
  await managed.repository.createWorkspace({
    name: 'SAMPLE previous',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  });
  const previous = await readFile(join(directory, 'factory-solo.sqlite3'));
  const preview = await managed.preview(donor.bytes, new Date().toISOString());
  expect(preview.workspaces.map((value) => value.id)).toEqual([donor.workspace.id]);
  expect(BigInt(preview.counts.audit)).toBeGreaterThan(0n);
  expect(await managed.activate(preview.token)).toEqual(preview.workspaces);
  expect(await readFile(join(directory, 'factory-solo.sqlite3'))).toEqual(previous);
  expect(
    (await managed.repository.snapshot({ kind: 'solo', workspaceId: donor.workspace.id })).audit,
  ).toEqual(
    (await donor.repository.snapshot({ kind: 'solo', workspaceId: donor.workspace.id })).audit,
  );
  await managed.close();
  const reopened = await ManagedDatabase.open(directory);
  resources.push(reopened);
  expect(await reopened.activate(preview.token)).toEqual(preview.workspaces);
  expect((await readdir(directory)).filter((value) => value.startsWith('restored-'))).toHaveLength(
    1,
  );
});

it.each(['candidate-write', 'pointer-write', 'pointer-replace'])(
  'preserves the old selection on %s failure and can retry the same token',
  async (failure) => {
    const donor = await source();
    const directory = await folder();
    let fail = true;
    const io: AtomicFileIO = {
      ...nativeAtomicFileIO,
      write: async (filename, bytes) => {
        if (
          fail &&
          ((failure === 'candidate-write' && filename.endsWith('.sqlite3')) ||
            (failure === 'pointer-write' && filename.endsWith('.partial')))
        ) {
          await nativeAtomicFileIO.write(filename, bytes.slice(0, 32));
          throw new Error('SAMPLE disk full');
        }
        await nativeAtomicFileIO.write(filename, bytes);
      },
      replace: async (from, to) => {
        if (fail && failure === 'pointer-replace') throw new Error('SAMPLE replace denied');
        await nativeAtomicFileIO.replace(from, to);
      },
    };
    const managed = await ManagedDatabase.open(directory, io);
    resources.push(managed);
    const old = await managed.repository.createWorkspace({
      name: 'SAMPLE preserved',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    });
    const previous = await readFile(join(directory, 'factory-solo.sqlite3'));
    const preview = await managed.preview(donor.bytes, new Date().toISOString());
    await expect(managed.activate(preview.token)).rejects.toThrow('SAMPLE');
    expect(await managed.repository.listWorkspaces()).toEqual([old]);
    expect(await readFile(join(directory, 'factory-solo.sqlite3'))).toEqual(previous);
    expect(await readdir(directory)).toEqual(['factory-solo.sqlite3']);
    fail = false;
    await managed.activate(preview.token);
    expect(await managed.repository.listWorkspaces()).toEqual(preview.workspaces);
  },
);

it('rejects expired, cancelled and stale previews without activating a candidate', async () => {
  const donor = await source();
  const directory = await folder();
  let time = Date.now();
  const managed = await ManagedDatabase.open(directory, nativeAtomicFileIO, () => time);
  resources.push(managed);
  let preview = await managed.preview(donor.bytes, new Date(time).toISOString());
  time += 16 * 60_000;
  await expect(managed.activate(preview.token)).rejects.toThrow('expired');
  preview = await managed.preview(donor.bytes, new Date(time).toISOString());
  managed.cancel(preview.token);
  await expect(managed.activate(preview.token)).rejects.toThrow('no longer available');
  preview = await managed.preview(donor.bytes, new Date(time).toISOString());
  await managed.repository.createWorkspace({
    name: 'SAMPLE intervening change',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  });
  await expect(managed.activate(preview.token)).rejects.toThrow('changed after preview');
  expect(await readdir(directory)).toEqual(['factory-solo.sqlite3']);
});

it('retains an existing selected recovery database when a later selector replacement fails', async () => {
  const donor = await source();
  const later = await source();
  const directory = await folder();
  let fail = false;
  const managed = await ManagedDatabase.open(directory, {
    ...nativeAtomicFileIO,
    replace: async (from, to) => {
      if (fail) throw new Error('SAMPLE selector denied');
      await nativeAtomicFileIO.replace(from, to);
    },
  });
  resources.push(managed);
  await managed.activate((await managed.preview(donor.bytes, new Date().toISOString())).token);
  const pointer = await readFile(join(directory, 'active-database.json'));
  const selected = JSON.parse(pointer.toString()) as { filename: string };
  const previous = await readFile(join(directory, selected.filename));
  const preview = await managed.preview(later.bytes, new Date().toISOString());
  fail = true;
  await expect(managed.activate(preview.token)).rejects.toThrow('selector denied');
  expect(await readFile(join(directory, 'active-database.json'))).toEqual(pointer);
  expect(await readFile(join(directory, selected.filename))).toEqual(previous);
  expect((await managed.repository.listWorkspaces())[0]!.id).toBe(donor.workspace.id);
  await managed.close();
  const reopened = await ManagedDatabase.open(directory);
  resources.push(reopened);
  expect((await reopened.repository.listWorkspaces())[0]!.id).toBe(donor.workspace.id);
});

it('validates real material issue and partial return custody without enabling consumption', async () => {
  const donor = await source();
  const authority = { kind: 'solo' as const, workspaceId: donor.workspace.id };
  const snapshot = await donor.repository.snapshot(authority);
  const lot = snapshot.lots[0]!,
    order = snapshot.records.find((value) => value.kind === 'sales_order')!;
  const engineering = snapshot.records.find((value) => value.kind === 'engineering')!,
    equipment = snapshot.records.find((value) => value.kind === 'equipment')!;
  const workOrderId = await commit(donor.repository, authority, 'save_record', {
    kind: 'work_order',
    code: 'SAMPLE-WO-R',
    name: 'SAMPLE restore work',
    fields: {
      orderId: order.id,
      engineeringId: engineering.id,
      itemId: lot.itemId,
      quantity: '10',
      equipmentId: equipment.id,
    },
  });
  await commit(donor.repository, authority, 'transition_record', {
    id: workOrderId,
    state: 'released',
  });
  await commit(donor.repository, authority, 'record_inspection', {
    lotId: lot.id,
    lower: '0',
    upper: '2',
    readings: ['1'],
    unit: 'pcs',
  });
  await commit(donor.repository, authority, 'release_lot', { lotId: lot.id });
  await commit(donor.repository, authority, 'issue_material', {
    workOrderId,
    lotId: lot.id,
    quantity: '4',
  });
  await commit(donor.repository, authority, 'return_material', {
    workOrderId,
    lotId: lot.id,
    quantity: '1',
  });
  expect((await validateSnapshot(await donor.driver.exportDatabase())).counts.lots).toBe('2');
});

it.each([
  'extra-trigger',
  'checksum',
  'foreign-key',
  'decimal',
  'custody',
  'reservation',
  'outcome',
  'release',
])('rejects unsupported or inconsistent snapshot data: %s', async (defect) => {
  const donor = await source();
  const snapshot = await donor.repository.snapshot({
    kind: 'solo',
    workspaceId: donor.workspace.id,
  });
  const lot = snapshot.lots[0]!,
    order = snapshot.records.find((value) => value.kind === 'sales_order')!;
  if (defect === 'extra-trigger')
    await donor.driver.run('CREATE TRIGGER surprise AFTER INSERT ON records BEGIN SELECT 1; END');
  if (defect === 'checksum')
    await donor.driver.run("UPDATE schema_versions SET checksum='SAMPLE unsupported'");
  if (defect === 'foreign-key') {
    await donor.driver.run('PRAGMA foreign_keys=OFF');
    await donor.driver.run("INSERT INTO lots VALUES(?,?,?,?,'SAMPLE','held',1)", [
      randomUUID(),
      donor.workspace.id,
      'SAMPLE orphan',
      randomUUID(),
    ]);
  }
  if (defect === 'decimal' || defect === 'custody')
    await donor.driver.run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?,?)', [
      randomUUID(),
      donor.workspace.id,
      lot.id,
      defect === 'decimal' ? '0.0000001' : '-100000',
      'stores',
      lot.id,
      'goods_receipt',
      new Date().toISOString(),
    ]);
  if (defect === 'reservation')
    await donor.driver.run("INSERT INTO reservations VALUES(?,?,?,?,?,'active')", [
      randomUUID(),
      donor.workspace.id,
      lot.id,
      order.id,
      '100000',
    ]);
  if (defect === 'outcome') await donor.driver.run("UPDATE idempotency SET result='{}'");
  if (defect === 'release') await donor.driver.run("UPDATE lots SET qc_state='released'");
  await expect(validateSnapshot(await donor.driver.exportDatabase())).rejects.toThrow();
});

it('validates dispatched stock, bounded customer returns and vendor custody from real commands', async () => {
  const donor = await source();
  const authority = { kind: 'solo' as const, workspaceId: donor.workspace.id };
  const snapshot = await donor.repository.snapshot(authority);
  const lot = snapshot.lots[0]!;
  const order = snapshot.records.find((value) => value.kind === 'sales_order')!;
  await commit(donor.repository, authority, 'record_inspection', {
    lotId: lot.id,
    lower: '0',
    upper: '2',
    readings: ['1'],
    unit: 'pcs',
  });
  await commit(donor.repository, authority, 'release_lot', { lotId: lot.id });
  const reservationId = await commit(donor.repository, authority, 'reserve_stock', {
    lotId: lot.id,
    orderId: order.id,
    quantity: '5',
  });
  const packageId = await commit(donor.repository, authority, 'verify_packing', {
    reservationId,
    quantity: '5',
    scannedLotCode: lot.code,
  });
  const shipmentId = await commit(donor.repository, authority, 'confirm_dispatch', {
    packageId,
    carrier: 'SAMPLE carrier',
  });
  await commit(donor.repository, authority, 'receive_customer_return', {
    shipmentId,
    quantity: '2',
    reason: 'SAMPLE return',
  });
  const supplier = snapshot.records.find((value) => value.kind === 'supplier')!;
  await commit(donor.repository, authority, 'send_jobwork', {
    lotId: lot.id,
    supplierId: supplier.id,
    quantity: '3',
  });
  await commit(donor.repository, authority, 'receive_jobwork', {
    lotId: lot.id,
    supplierId: supplier.id,
    quantity: '2',
    loss: '1',
    reason: 'SAMPLE loss',
  });
  expect((await validateSnapshot(await donor.driver.exportDatabase())).counts.lots).toBe('3');
});

it('never falls back when a selector is corrupt, and ignores an interrupted unselected candidate', async () => {
  const directory = await folder();
  const managed = await ManagedDatabase.open(directory);
  resources.push(managed);
  const old = await managed.repository.createWorkspace({
    name: 'SAMPLE original',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  });
  await managed.close();
  await writeFile(join(directory, `restored-${randomUUID()}.sqlite3`), 'SAMPLE partial');
  const reopened = await ManagedDatabase.open(directory);
  resources.push(reopened);
  expect(await reopened.repository.listWorkspaces()).toEqual([old]);
  await reopened.close();
  await writeFile(
    join(directory, 'active-database.json'),
    JSON.stringify({ filename: '../other.sqlite3' }),
  );
  await expect(ManagedDatabase.open(directory)).rejects.toThrow('selector is invalid');
});

it('durably retains one restore token, blocks replacement and fails closed on invalid or denied journal storage', async () => {
  const donor = await source();
  const directory = await folder();
  const managed = await ManagedDatabase.open(directory);
  resources.push(managed);
  const preview = await managed.preview(donor.bytes, new Date().toISOString());
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  const journal = new LocalRecoveryJournal(() => storage);
  journal.save(preview);
  expect(new LocalRecoveryJournal(() => storage).read()).toEqual(preview);
  expect(() => journal.save({ ...preview, token: randomUUID() })).toThrow('No activation');
  data.set('fasteners-restore:v1', '{}');
  expect(() => journal.read()).toThrow('invalid');
  expect(() =>
    new LocalRecoveryJournal(() => {
      throw new Error('SAMPLE denied');
    }).read(),
  ).toThrow('unavailable');
  journal.clear();
  expect(journal.read()).toBeNull();
});
