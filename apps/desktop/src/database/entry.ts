import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  authoritySchema,
  parseCommand,
  DomainError,
  type CreateWorkspace,
} from '@fasteners/contracts';
import { initialize, LocalRepository } from '@fasteners/local-domain';
import { DesktopSqlDriver } from '@fasteners/sqlite-desktop';
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
  await mkdir(directory!, { recursive: true });
  const driver = new DesktopSqlDriver(join(directory!, 'factory-solo.sqlite3'));
  await initialize(driver);
  const repository = new LocalRepository(driver, 'local-owner:desktop');
  let queue: Promise<unknown> = Promise.resolve();
  port.on('message', (event) => {
    const packet = event.data;
    queue = queue.then(async () => {
      try {
        let value: unknown;
        switch (packet.method) {
          case 'listWorkspaces':
            value = await repository.listWorkspaces();
            break;
          case 'createWorkspace':
            value = await repository.createWorkspace(packet.args[0] as CreateWorkspace);
            break;
          case 'snapshot':
            value = await repository.snapshot(authoritySchema.parse(packet.args[0]));
            break;
          case 'execute':
            value = await repository.execute(parseCommand(packet.args[0]));
            break;
          case 'exportDatabase':
            value = await driver.exportDatabase();
            break;
          case 'close':
            await repository.close();
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
