import { describe, expect, it, vi } from 'vitest';
import { CloudRepository, createCloudClient } from '../../packages/cloud-repository/src';
import { request } from '../../packages/application/src';

function command() {
  return request(
    { kind: 'team', companyId: crypto.randomUUID(), plantId: crypto.randomUUID() },
    'hold_lot',
    { lotId: crypto.randomUUID(), reason: 'SAMPLE hold' },
  );
}
describe('team confirmation boundary', () => {
  it('does not send critical writes while offline', async () => {
    const rpc = vi.fn();
    const repository = new CloudRepository(
      { rpc } as unknown as ReturnType<typeof createCloudClient>,
      () => false,
    );
    const input = command();
    const result = await repository.execute(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('OFFLINE_TEAM_WRITE_BLOCKED');
      expect(result.error.correlationId).toBe(input.idempotencyKey);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it('retains the original key for malformed or foreign successful confirmations', async () => {
    const input = command();
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const repository = new CloudRepository(
      { rpc } as unknown as ReturnType<typeof createCloudClient>,
      () => true,
    );
    const malformed = await repository.execute(input);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.error.code).toBe('CONFIRMATION_UNKNOWN');
      expect(malformed.error.correlationId).toBe(input.idempotencyKey);
    }
    rpc.mockResolvedValue({
      data: {
        ok: true,
        value: { id: crypto.randomUUID(), message: 'SAMPLE' },
        committedAt: new Date().toISOString(),
        authority: { kind: 'team', companyId: crypto.randomUUID() },
      },
      error: null,
    });
    const foreign = await repository.execute(input);
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.code).toBe('CONFIRMATION_UNKNOWN');
  });
});
