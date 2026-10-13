import {
  authoritySchema,
  parseCommand,
  DomainError,
  type CreateWorkspace,
} from '@fasteners/contracts';
import { ManagedDatabase } from './managed-database';
interface ParentPort {
  on(
    event: 'message',
    listener: (event: { data: { id: string; method: string; args: unknown[] } }) => void,
  ): void;
  postMessage(value: unknown): void;
}
const port = (process as NodeJS.Process & { parentPort: ParentPort }).parentPort;
const directory = process.argv[2];
if (!directory) throw new Error('A managed database directory is required.');
async function start() {
  const managed = await ManagedDatabase.open(directory!);
  let queue: Promise<unknown> = Promise.resolve();
  port.on('message', (event) => {
    const packet = event.data;
    queue = queue.then(async () => {
      try {
        let value: unknown;
        switch (packet.method) {
          case 'listWorkspaces':
            value = await managed.repository.listWorkspaces();
            break;
          case 'createWorkspace':
            value = await managed.repository.createWorkspace(packet.args[0] as CreateWorkspace);
            break;
          case 'snapshot':
            value = await managed.repository.snapshot(authoritySchema.parse(packet.args[0]));
            break;
          case 'execute':
            value = await managed.repository.execute(parseCommand(packet.args[0]));
            break;
          case 'exportDatabase':
            value = await managed.driver.exportDatabase();
            break;
          case 'previewRestore':
            value = await managed.preview(
              new Uint8Array(packet.args[0] as Uint8Array),
              String(packet.args[1]),
            );
            break;
          case 'activateRestore':
            value = await managed.activate(String(packet.args[0]));
            break;
          case 'cancelRestore':
            managed.cancel(String(packet.args[0]));
            break;
          case 'close':
            await managed.close();
            break;
          default:
            throw new DomainError('INVALID_INPUT', 'Unsupported database operation.');
        }
        port.postMessage({ id: packet.id, ok: true, value });
      } catch (error) {
        port.postMessage({
          id: packet.id,
          ok: false,
          error: {
            code: error instanceof DomainError ? error.code : 'STORAGE_UNAVAILABLE',
            message:
              error instanceof DomainError ? error.message : 'Managed database operation failed.',
          },
        });
      }
    });
  });
  port.postMessage({ ready: true });
}
void start();
