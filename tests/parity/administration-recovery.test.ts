import { describe, expect, it, vi } from 'vitest';
import {
  AdministrationController,
  type TeamAuthPort,
  type TeamAdministrationPort,
} from '../../packages/application/src';
import { AdministrationJournal } from '../../packages/client-storage/src';
import { CloudAdministration, type CloudClient } from '../../packages/cloud-repository/src';
import {
  DomainError,
  type AdministrationOperation,
  type AdministrationRequest,
  type AdministrationResult,
} from '../../packages/contracts/src';

const actor = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const company = '10000000-0000-4000-8000-000000000003';
const endpoint = 'https://sample-backend.invalid';
const token = 'SAMPLE-invitation-token-0123456789';
const operations: AdministrationOperation[] = [
  {
    command: 'invite_member',
    input: {
      email: 'sample@example.invalid',
      roles: ['Stores', 'Quality inspector'],
      plantIds: [company],
      allPlants: false,
    },
  },
  { command: 'create_plant', input: { name: 'SAMPLE Plant', warehouseName: 'SAMPLE Stores' } },
  {
    command: 'update_member_access',
    input: {
      id: other,
      email: 'sample@example.invalid',
      active: false,
      roles: ['Stores'],
      plantIds: [company],
      allPlants: false,
      grants: [],
    },
  },
];
function result(request: AdministrationRequest): AdministrationResult {
  return request.operation.command === 'invite_member'
    ? { command: request.operation.command, id: company, token }
    : {
        command: request.operation.command,
        id:
          request.operation.command === 'update_member_access'
            ? request.operation.input.id
            : company,
      };
}
function fixture() {
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
  const journal = () => new AdministrationJournal(storage, endpoint, () => locks);
  const currentUser = vi
    .fn()
    .mockResolvedValue({ id: actor, email: 'sample@example.invalid', verified: true });
  const execute = vi
    .fn()
    .mockImplementation(async (request: AdministrationRequest) => result(request));
  const auth = { currentUser } as unknown as TeamAuthPort;
  const administration = { execute } as unknown as TeamAdministrationPort;
  return {
    data,
    storage,
    journal,
    currentUser,
    execute,
    controller: () => new AdministrationController(auth, administration, journal()),
  };
}
describe('durable administration lifecycle', () => {
  it.each(operations)(
    'retries the exact $command request after restart without persisting invitation tokens',
    async (operation) => {
      const f = fixture();
      f.execute.mockRejectedValueOnce(new Error('SAMPLE acknowledgment lost'));
      await expect(f.controller().submit(actor, company, operation)).rejects.toMatchObject({
        code: 'CONFIRMATION_UNKNOWN',
      });
      const original = f.journal().read(actor)!;
      expect(original.operation).toEqual(operation);
      expect(JSON.stringify([...f.data.values()])).not.toContain(token);
      expect(f.journal().read(other)).toBeNull();
      expect(
        new AdministrationJournal(f.storage, 'https://other-backend.invalid').read(actor),
      ).toBeNull();
      await expect(f.controller().submit(actor, company, operations[1]!)).rejects.toMatchObject({
        code: 'CONFIRMATION_UNKNOWN',
      });
      await expect(f.controller().retry(actor)).resolves.toEqual({
        value: result(original),
        journalCleared: true,
      });
      expect(f.execute.mock.calls).toEqual([[original], [original]]);
      expect(f.journal().read(actor)).toBeNull();
    },
  );
  it('retains an uncertain attempt after revoked permission, offline retry or changed identity', async () => {
    const f = fixture();
    f.execute
      .mockRejectedValueOnce(new Error('Unknown'))
      .mockRejectedValueOnce(new DomainError('PERMISSION_DENIED', 'Revoked'))
      .mockRejectedValueOnce(new DomainError('OFFLINE_TEAM_WRITE_BLOCKED', 'Offline'));
    await expect(f.controller().submit(actor, company, operations[0]!)).rejects.toThrow();
    const original = f.journal().read(actor);
    await expect(f.controller().retry(actor)).rejects.toMatchObject({
      code: 'CONFIRMATION_UNKNOWN',
    });
    await expect(f.controller().retry(actor)).rejects.toMatchObject({
      code: 'CONFIRMATION_UNKNOWN',
    });
    f.currentUser.mockResolvedValue({ id: other, verified: true });
    await expect(f.controller().retry(actor)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(f.journal().read(actor)).toEqual(original);
    expect(f.execute).toHaveBeenCalledTimes(3);
  });
  it('clears a definitive initial rejection and rejects malformed input before sending', async () => {
    const f = fixture();
    f.execute.mockRejectedValue(new DomainError('PERMISSION_DENIED', 'Denied'));
    await expect(f.controller().submit(actor, company, operations[1]!)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    expect(f.journal().read(actor)).toBeNull();
    await expect(
      f
        .controller()
        .submit(actor, company, {
          command: 'create_plant',
          input: { name: ' ', warehouseName: 'SAMPLE' },
        }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(f.controller().submit(actor, 'forged', operations[1]!)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(f.execute).toHaveBeenCalledTimes(1);
  });
  it('blocks corruption, actor substitution and quota before dispatch', async () => {
    const f = fixture();
    const key = `fasteners-administration:v1:${encodeURIComponent(endpoint)}:${actor}`;
    f.data.set(key, '{invalid');
    await expect(f.controller().submit(actor, company, operations[0]!)).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });
    f.data.set(
      key,
      JSON.stringify({
        contractVersion: 1,
        actorId: other,
        companyId: company,
        requestKey: crypto.randomUUID(),
        operation: operations[0],
      }),
    );
    expect(() => f.journal().read(actor)).toThrow('Preserve it for recovery');
    f.data.clear();
    f.storage.setItem = () => {
      throw new Error('Quota');
    };
    await expect(f.controller().submit(actor, company, operations[0]!)).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });
    expect(f.execute).not.toHaveBeenCalled();
  });
  it('holds the writer lock across persistence and confirmation', async () => {
    const f = fixture();
    let done!: (value: AdministrationResult) => void;
    f.execute.mockImplementation(async (request: AdministrationRequest) => {
      expect(f.journal().read(actor)).toEqual(request);
      return new Promise<AdministrationResult>((resolve) => {
        done = resolve;
      });
    });
    const first = f.controller().submit(actor, company, operations[1]!);
    await vi.waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1));
    await expect(f.controller().submit(actor, company, operations[0]!)).rejects.toMatchObject({
      code: 'WORKSPACE_BUSY',
    });
    done(result(f.journal().read(actor)!));
    await expect(first).resolves.toMatchObject({ journalCleared: true });
  });
  it('separates committed outcome from failed cleanup and rejects foreign confirmation', async () => {
    const f = fixture();
    const remove = f.storage.removeItem;
    f.storage.removeItem = () => {
      throw new Error('Denied');
    };
    await expect(f.controller().submit(actor, company, operations[1]!)).resolves.toMatchObject({
      journalCleared: false,
    });
    f.storage.removeItem = remove;
    await f.controller().retry(actor);
    f.execute.mockResolvedValue({ command: 'update_member_access', id: company });
    await expect(f.controller().submit(actor, company, operations[2]!)).rejects.toMatchObject({
      code: 'CONFIRMATION_UNKNOWN',
    });
    expect(f.journal().read(actor)).not.toBeNull();
  });
});
describe('typed administration RPC boundary', () => {
  function cloud(response: unknown) {
    const setHeader = vi.fn().mockResolvedValue(response);
    const rpc = vi.fn().mockReturnValue({ setHeader });
    const getUser = vi
      .fn()
      .mockResolvedValue({
        data: { user: { id: actor, email_confirmed_at: new Date().toISOString() } },
        error: null,
      });
    const client = {
      rpc,
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'SAMPLE-session-token' } },
          error: null,
        }),
        getUser,
      },
    } as unknown as CloudClient;
    return { client, rpc, setHeader, getUser, adapter: new CloudAdministration(client) };
  }
  const request = (operation: AdministrationOperation): AdministrationRequest => ({
    contractVersion: 1,
    actorId: actor,
    companyId: company,
    requestKey: crypto.randomUUID(),
    operation,
  });
  it.each(operations)(
    'maps $command with the original key/company and pinned verified token',
    async (operation) => {
      const data =
        operation.command === 'invite_member'
          ? { id: company, token }
          : operation.command === 'create_plant'
            ? company
            : null;
      const f = cloud({ data, error: null, status: 200 });
      const input = request(operation);
      await expect(f.adapter.execute(input)).resolves.toEqual(result(input));
      expect(f.rpc).toHaveBeenCalledWith(
        operation.command,
        expect.objectContaining({ company, request_key: input.requestKey }),
      );
      expect(f.getUser).toHaveBeenCalledWith('SAMPLE-session-token');
      expect(f.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer SAMPLE-session-token');
    },
  );
  it('rejects malformed success, proxy errors and unrecognized rollback as unknown', async () => {
    for (const response of [
      { data: {}, error: null, status: 200 },
      { data: null, error: null, status: 502 },
      { data: null, error: { code: 'P0001', message: 'PERMISSION_DENIED' }, status: 502 },
      { data: null, error: { code: 'P0001', message: 'Unexpected' }, status: 400 },
    ])
      await expect(cloud(response).adapter.execute(request(operations[0]!))).rejects.toMatchObject({
        code: 'CONFIRMATION_UNKNOWN',
      });
    await expect(
      cloud({ data: {}, error: null, status: 200 }).adapter.execute(request(operations[2]!)),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_UNKNOWN' });
  });
  it('recognizes a definitive permission rollback, blocks offline dispatch and rejects changed actor', async () => {
    const f = cloud({
      data: null,
      error: { code: 'P0001', message: 'PERMISSION_DENIED' },
      status: 400,
    });
    await expect(f.adapter.execute(request(operations[1]!))).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    const offline = new CloudAdministration(f.client, () => false);
    f.rpc.mockClear();
    await expect(offline.execute(request(operations[1]!))).rejects.toMatchObject({
      code: 'OFFLINE_TEAM_WRITE_BLOCKED',
    });
    await expect(
      f.adapter.execute({ ...request(operations[1]!), actorId: other }),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
