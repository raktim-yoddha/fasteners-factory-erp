import { open, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

export interface BackupFileIO {
  write(filename: string, bytes: Uint8Array): Promise<void>;
  replace(source: string, destination: string): Promise<void>;
  remove(filename: string): Promise<void>;
}
export const nativeBackupFileIO: BackupFileIO = {
  async write(filename, bytes) {
    const file = await open(filename, 'wx', 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
  },
  replace: rename,
  remove: (filename) => rm(filename, { force: true }),
};
export async function saveEncryptedFile(
  filename: string,
  bytes: Uint8Array,
  io: BackupFileIO = nativeBackupFileIO,
): Promise<void> {
  const temporary = join(dirname(filename), `.${basename(filename)}.${randomUUID()}.partial`);
  try {
    await io.write(temporary, bytes);
    await io.replace(temporary, filename);
  } finally {
    await io.remove(temporary);
  }
}
