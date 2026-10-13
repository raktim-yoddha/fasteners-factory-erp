import { describe, expect, it } from 'vitest';
import { add, canonical, decimal, multiply, scaled, subtract } from '../../packages/domain/src';
import { parseCommand } from '../../packages/contracts/src';
describe('shared authority vectors', () => {
  it('preserves exact decimals and large values through JSON', () => {
    expect(add('0.1', '0.2')).toBe('0.3');
    expect(subtract('10.000001', '0.000001')).toBe('10');
    expect(multiply('4.5', '100')).toBe('450');
    const value = '9007199254740993.000001';
    expect(decimal(scaled(JSON.parse(JSON.stringify(value)) as string))).toBe(value);
  });
  it('canonicalizes field order for idempotency and rejects numeric payload values', () => {
    expect(canonical({ b: '2', a: '1' })).toBe(canonical({ a: '1', b: '2' }));
    expect(() =>
      parseCommand({
        contractVersion: 1,
        command: 'receive_goods',
        authority: { kind: 'solo', workspaceId: crypto.randomUUID() },
        idempotencyKey: crypto.randomUUID(),
        payload: {
          itemId: crypto.randomUUID(),
          quantity: 0.1,
          location: 'A',
          supplierReference: 'SAMPLE',
        },
      }),
    ).toThrow();
  });
});
