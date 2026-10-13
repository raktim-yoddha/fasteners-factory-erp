import { describe, expect, it } from 'vitest';
import { PendingJournal } from '../../packages/client-storage/src';
import { request } from '../../packages/application/src';
import { commandResultSchema, snapshotSchema } from '../../packages/contracts/src';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
describe('durable request and response boundaries', () => {
  it('retains the exact request after a new adapter instance and isolates identity and authority', () => {
    const data = storage();
    const journal = new PendingJournal(data);
    const authority = { kind: 'team' as const, companyId: crypto.randomUUID() };
    const command = request(authority, 'hold_lot', {
      lotId: crypto.randomUUID(),
      reason: 'SAMPLE hold',
    });
    journal.save('SAMPLE-actor-a', command);
    expect(new PendingJournal(data).read('SAMPLE-actor-a', authority)).toEqual(command);
    expect(journal.read('SAMPLE-actor-b', authority)).toBeNull();
    expect(
      journal.read('SAMPLE-actor-a', { ...authority, companyId: crypto.randomUUID() }),
    ).toBeNull();
    expect(() =>
      journal.save('SAMPLE-actor-a', { ...command, idempotencyKey: crypto.randomUUID() }),
    ).toThrow('before dispatch');
    journal.clear('SAMPLE-actor-a', authority);
    expect(journal.read('SAMPLE-actor-a', authority)).toBeNull();
  });
  it('blocks storage failure and malformed journals before dispatch', () => {
    const journal = new PendingJournal({
      getItem: () => '{invalid',
      setItem: () => {
        throw new Error('Quota');
      },
      removeItem: () => undefined,
    });
    const authority = { kind: 'solo' as const, workspaceId: crypto.randomUUID() };
    const denied = new PendingJournal(() => {
      throw new Error('Storage permission denied');
    });
    expect(() => denied.read('owner', authority)).toThrow('Preserve it for recovery');
    expect(() => journal.read('owner', authority)).toThrow('Preserve it for recovery');
    expect(() =>
      journal.save(
        'owner',
        request(authority, 'hold_lot', { lotId: crypto.randomUUID(), reason: 'SAMPLE hold' }),
      ),
    ).toThrow('before dispatch');
  });
  it('rejects incomplete successful confirmations and numeric read quantities', () => {
    expect(
      commandResultSchema.safeParse({
        ok: true,
        value: { id: crypto.randomUUID(), message: 'SAMPLE' },
      }).success,
    ).toBe(false);
    const id = crypto.randomUUID();
    const snapshot = {
      workspace: {
        id,
        name: 'SAMPLE',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString(),
      },
      records: [],
      lots: [
        {
          id,
          itemId: id,
          code: 'SAMPLE',
          itemName: 'SAMPLE',
          unit: 'pcs',
          location: 'SAMPLE',
          qcState: 'held',
          revision: '1',
          onHand: 1,
          available: '0',
          reserved: '0',
          wip: '0',
          vendor: '0',
        },
      ],
      reservations: [],
      packages: [],
      shipments: [],
      audit: [],
      asOf: new Date().toISOString(),
    };
    expect(snapshotSchema.safeParse(snapshot).success).toBe(false);
    expect(
      snapshotSchema.parse({ ...snapshot, lots: [{ ...snapshot.lots[0], onHand: '1' }] }).lots[0]!
        .onHand,
    ).toBe('1');
  });
});
