import { expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { nativeBackupFileIO, saveEncryptedFile } from '../../apps/desktop/src/main/backup-file';

it('preserves the previous backup after partial write or replacement failure and cleans temporary ciphertext', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-backup-io-tests-'));
  const filename = join(directory, 'existing.fferp');
  const original = new Uint8Array([1, 2, 3]);
  const replacement = new Uint8Array([4, 5, 6]);
  try {
    await writeFile(filename, original);
    await expect(
      saveEncryptedFile(filename, replacement, {
        ...nativeBackupFileIO,
        write: async (temporary, bytes) => {
          await nativeBackupFileIO.write(temporary, bytes.slice(0, 1));
          throw new Error('Simulated disk full');
        },
      }),
    ).rejects.toThrow('disk full');
    expect(new Uint8Array(await readFile(filename))).toEqual(original);
    expect(await readdir(directory)).toEqual(['existing.fferp']);
    await expect(
      saveEncryptedFile(filename, replacement, {
        ...nativeBackupFileIO,
        replace: async () => {
          throw new Error('Simulated replacement denied');
        },
      }),
    ).rejects.toThrow('replacement denied');
    expect(new Uint8Array(await readFile(filename))).toEqual(original);
    expect(await readdir(directory)).toEqual(['existing.fferp']);
    await saveEncryptedFile(filename, replacement);
    expect(new Uint8Array(await readFile(filename))).toEqual(replacement);
    expect(await readdir(directory)).toEqual(['existing.fferp']);
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'factory-backup-io-tests-')))
      throw new Error('Unsafe backup test cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});
