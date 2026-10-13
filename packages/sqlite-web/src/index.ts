import {
  DomainError,
  type Authority,
  type CommandRequest,
  type CommandResult,
  type CreateWorkspace,
  type Repository,
  type Snapshot,
  type Workspace,
} from '@fasteners/contracts';
export class BrowserRepository implements Repository {
  private readonly worker: Worker;
  private readonly pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private closed = false;
  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (
      event: MessageEvent<{
        id: string;
        value?: unknown;
        error?: { code: string; message: string };
      }>,
    ) => {
      const call = this.pending.get(event.data.id);
      if (!call) return;
      this.pending.delete(event.data.id);
      if (event.data.error)
        call.reject(
          new DomainError(
            event.data.error.code === 'WORKSPACE_BUSY' ? 'WORKSPACE_BUSY' : 'STORAGE_UNAVAILABLE',
            event.data.error.message,
          ),
        );
      else call.resolve(event.data.value);
    };
    this.worker.onerror = () => {
      for (const call of this.pending.values())
        call.reject(
          new DomainError(
            'STORAGE_UNAVAILABLE',
            'Database worker failed. Reopen the workspace and verify the last request.',
          ),
        );
      this.pending.clear();
    };
  }
  private call<T>(method: string, args: unknown[] = []): Promise<T> {
    if (this.closed)
      return Promise.reject(new DomainError('STORAGE_UNAVAILABLE', 'Storage is closed.'));
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.worker.postMessage({ id, method, args });
    });
  }
  listWorkspaces(): Promise<Workspace[]> {
    return this.call('listWorkspaces');
  }
  createWorkspace(input: CreateWorkspace): Promise<Workspace> {
    return this.call('createWorkspace', [input]);
  }
  snapshot(authority: Authority): Promise<Snapshot> {
    return this.call('snapshot', [authority]);
  }
  async execute(request: CommandRequest): Promise<CommandResult> {
    try {
      return await this.call('execute', [request]);
    } catch (error) {
      return {
        ok: false,
        error: {
          code:
            error instanceof DomainError && error.code === 'WORKSPACE_BUSY'
              ? 'WORKSPACE_BUSY'
              : 'CONFIRMATION_UNKNOWN',
          message: error instanceof Error ? error.message : 'Database confirmation unknown.',
          retryable: true,
          correlationId: request.idempotencyKey,
        },
      };
    }
  }
  exportDatabase(): Promise<Uint8Array> {
    return this.call('exportDatabase');
  }
  async close(): Promise<void> {
    if (this.closed) return;
    try {
      await this.call('close');
    } finally {
      this.closed = true;
      this.worker.terminate();
      for (const call of this.pending.values())
        call.reject(new DomainError('STORAGE_UNAVAILABLE', 'Storage closed.'));
      this.pending.clear();
    }
  }
}
