import { describe, expect, it, vi } from 'vitest';
import { CompanySetupController, type TeamAuthPort } from '../../packages/application/src';
import { CompanySetupJournal } from '../../packages/client-storage/src';
import { CloudAuth, type CloudClient } from '../../packages/cloud-repository/src';
import { DomainError, type CompanySetupRequest } from '../../packages/contracts/src';

const actorId = '10000000-0000-4000-8000-000000000001';
const otherId = '10000000-0000-4000-8000-000000000002';
const companyId = '10000000-0000-4000-8000-000000000003';
const input = {
  name: 'SAMPLE Company',
  plantName: 'SAMPLE Plant',
  warehouseName: 'SAMPLE Warehouse',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
};
function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  let held = false;
  const locks = {
    request: async (
      _key: string,
      _options: unknown,
      fn: (lock: object | null) => Promise<unknown>,
    ) => {
      if (held) return fn(null);
      held = true;
      try {
        return await fn({});
      } finally {
        held = false;
      }
    },
  } as Pick<LockManager, 'request'>;
  const journal = () =>
    new CompanySetupJournal(storage, 'https://sample-backend.invalid', () => locks);
  const currentUser = vi
    .fn()
    .mockResolvedValue({ id: actorId, email: 'sample@example.invalid', verified: true });
  const createCompany = vi.fn().mockResolvedValue(companyId);
  const auth = { currentUser, createCompany } as unknown as TeamAuthPort;
  return {
    values,
    storage,
    journal,
    currentUser,
    createCompany,
    auth,
    controller: () => new CompanySetupController(auth, journal()),
  };
}
describe('company setup recovery', () => {
  it('retains exact input and key through restart, rejects replacement and isolates accounts', async () => {
    const f = fixture();
    f.createCompany.mockRejectedValueOnce(new Error('Lost acknowledgment'));
    await expect(f.controller().submit(actorId, input)).rejects.toMatchObject({
      code: 'CONFIRMATION_UNKNOWN',
    });
    const original = f.journal().read(actorId)!;
    expect(original.input).toEqual(input);
    expect(f.journal().read(otherId)).toBeNull();
    expect(
      new CompanySetupJournal(f.storage, 'https://other-backend.invalid').read(actorId),
    ).toBeNull();
    await expect(
      f.controller().submit(actorId, { ...input, name: 'SAMPLE replacement' }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_UNKNOWN' });
    await expect(f.controller().retry(actorId)).resolves.toEqual({
      companyId,
      journalCleared: true,
    });
    expect(f.createCompany.mock.calls).toEqual([
      [input, original.requestKey, actorId],
      [input, original.requestKey, actorId],
    ]);
    expect(f.journal().read(actorId)).toBeNull();
  });
  it('preserves an uncertain request even when its retry is rejected', async () => {
    const f = fixture();
    f.createCompany
      .mockRejectedValueOnce(new Error('Unknown'))
      .mockRejectedValueOnce(new DomainError('AUTH_REQUIRED', 'Denied'));
    await expect(f.controller().submit(actorId, input)).rejects.toMatchObject({
      code: 'CONFIRMATION_UNKNOWN',
    });
    const original = f.journal().read(actorId);
    await expect(f.controller().retry(actorId)).rejects.toMatchObject({
      code: 'CONFIRMATION_UNKNOWN',
    });
    expect(f.journal().read(actorId)).toEqual(original);
  });
  it('clears a definitive initial rejection and sends no malformed input', async () => {
    const f = fixture();
    await expect(f.controller().submit(actorId, { ...input, name: ' ' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(f.createCompany).not.toHaveBeenCalled();
    f.createCompany.mockRejectedValue(new DomainError('INVALID_INPUT', 'Invalid timezone'));
    await expect(f.controller().submit(actorId, input)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(f.journal().read(actorId)).toBeNull();
  });
  it('does not send for changed or unverified identity and retains the original', async () => {
    const f = fixture();
    f.createCompany.mockRejectedValue(new Error('Unknown'));
    await expect(f.controller().submit(actorId, input)).rejects.toThrow();
    const original = f.journal().read(actorId);
    f.currentUser.mockResolvedValue({ id: otherId, verified: true });
    await expect(f.controller().retry(actorId)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    f.currentUser.mockResolvedValue({ id: actorId, verified: false });
    await expect(f.controller().retry(actorId)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(f.createCompany).toHaveBeenCalledTimes(1);
    expect(f.journal().read(actorId)).toEqual(original);
  });
  it('fails closed for corruption, account mismatch, storage quota and unavailable locks', async () => {
    const f = fixture();
    f.values.set(
      `fasteners-company-setup:v1:${encodeURIComponent('https://sample-backend.invalid')}:${actorId}`,
      '{invalid',
    );
    await expect(f.controller().submit(actorId, input)).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });
    f.values.set(
      `fasteners-company-setup:v1:${encodeURIComponent('https://sample-backend.invalid')}:${actorId}`,
      JSON.stringify({
        contractVersion: 1,
        actorId: otherId,
        requestKey: crypto.randomUUID(),
        input,
      }),
    );
    expect(() => f.journal().read(actorId)).toThrow('Preserve it for recovery');
    f.values.clear();
    f.storage.setItem = () => {
      throw new Error('Quota');
    };
    await expect(f.controller().submit(actorId, input)).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });
    const store = new CompanySetupJournal(f.storage, 'https://sample-backend.invalid', () => {
      throw new Error('No lock API');
    });
    await expect(
      new CompanySetupController(f.auth, store).submit(actorId, input),
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    expect(f.createCompany).not.toHaveBeenCalled();
  });
  it('blocks a competing writer and persists before the first dispatch', async () => {
    const f = fixture();
    let resolve!: (id: string) => void;
    f.createCompany.mockImplementation(async (_input, key) => {
      expect(f.journal().read(actorId)?.requestKey).toBe(key);
      return new Promise<string>((done) => {
        resolve = done;
      });
    });
    const first = f.controller().submit(actorId, input);
    await vi.waitFor(() => expect(f.createCompany).toHaveBeenCalledTimes(1));
    await expect(f.controller().submit(actorId, input)).rejects.toMatchObject({
      code: 'WORKSPACE_BUSY',
    });
    resolve(companyId);
    await expect(first).resolves.toEqual({ companyId, journalCleared: true });
  });
  it('reports committed separately from journal cleanup failure and retries once', async () => {
    const f = fixture();
    const remove = f.storage.removeItem;
    f.storage.removeItem = () => {
      throw new Error('Denied');
    };
    await expect(f.controller().submit(actorId, input)).resolves.toEqual({
      companyId,
      journalCleared: false,
    });
    const original = f.journal().read(actorId)!;
    f.storage.removeItem = remove;
    await f.controller().retry(actorId);
    expect(f.createCompany.mock.calls[1]?.[1]).toBe(original.requestKey);
    expect(f.journal().read(actorId)).toBeNull();
  });
  it('rejects a changed pending payload and malformed success without deleting evidence', async () => {
    const f = fixture();
    f.createCompany.mockResolvedValue('malformed');
    await expect(f.controller().submit(actorId, input)).rejects.toMatchObject({
      code: 'CONFIRMATION_UNKNOWN',
    });
    const original = f.journal().read(actorId)!;
    expect(() => f.journal().save({ ...original, input: { ...input, name: 'Changed' } })).toThrow(
      'before dispatch',
    );
    expect(() =>
      f.journal().clear({ ...original, requestKey: crypto.randomUUID() } as CompanySetupRequest),
    ).toThrow('cleanup failed');
    expect(f.journal().read(actorId)).toEqual(original);
  });
});

describe('company RPC confirmation and token boundary', () => {
  function cloud(response: unknown) {
    const setHeader = vi.fn().mockResolvedValue(response);
    const rpc = vi.fn().mockReturnValue({ setHeader });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: actorId, email_confirmed_at: new Date().toISOString() } },
      error: null,
    });
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: 'SAMPLE-test-token' } }, error: null });
    const auth = new CloudAuth({ rpc, auth: { getSession, getUser } } as unknown as CloudClient);
    return { auth, rpc, setHeader, getUser };
  }
  it('validates the successful UUID and pins its verified session token', async () => {
    const f = cloud({ data: companyId, error: null, status: 200 });
    await expect(f.auth.createCompany(input, crypto.randomUUID(), actorId)).resolves.toBe(
      companyId,
    );
    expect(f.getUser).toHaveBeenCalledWith('SAMPLE-test-token');
    expect(f.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer SAMPLE-test-token');
  });
  it('never sends for an account mismatch', async () => {
    const f = cloud({ data: companyId, error: null, status: 200 });
    await expect(f.auth.createCompany(input, crypto.randomUUID(), otherId)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('blocks company setup while offline before contacting Auth or RPC', async () => {
    const f = cloud({ data: companyId, error: null, status: 200 });
    vi.stubGlobal('navigator', { onLine: false });
    try {
      await expect(f.auth.createCompany(input, crypto.randomUUID(), actorId)).rejects.toMatchObject(
        { code: 'OFFLINE_TEAM_WRITE_BLOCKED' },
      );
      expect(f.getUser).not.toHaveBeenCalled();
      expect(f.rpc).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('treats malformed, network, proxy and unexpected replies as unknown', async () => {
    for (const response of [
      { data: null, error: null, status: 204 },
      { data: null, error: { code: '', message: 'Fetch failed' }, status: 0 },
      { data: null, error: { code: 'P0001', message: 'INVALID_INPUT' }, status: 502 },
      { data: null, error: { code: 'P0001', message: 'Unexpected database error' }, status: 400 },
    ]) {
      await expect(
        cloud(response).auth.createCompany(input, crypto.randomUUID(), actorId),
      ).rejects.toMatchObject({ code: 'CONFIRMATION_UNKNOWN' });
    }
  });
  it('recognizes a definitive PostgreSQL rollback response', async () => {
    const f = cloud({
      data: null,
      error: { code: 'P0001', message: 'INVALID_INPUT' },
      status: 400,
    });
    await expect(f.auth.createCompany(input, crypto.randomUUID(), actorId)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });
});
