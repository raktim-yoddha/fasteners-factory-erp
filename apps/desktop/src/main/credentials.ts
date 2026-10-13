import { safeStorage } from 'electron';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { DomainError } from '@fasteners/contracts';
const allowed = new Set(['fasteners-cloud-auth', 'fasteners-cloud-auth-code-verifier']);
export class Credentials {
  constructor(private readonly directory: string) {}
  private path(key: string): string {
    if (!allowed.has(key)) throw new DomainError('INVALID_INPUT', 'Unsupported credential key.');
    if (!safeStorage.isEncryptionAvailable())
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'OS-backed credential encryption is unavailable. Team sign-in cannot persist securely.',
      );
    return join(this.directory, `${key}.bin`);
  }
  async get(key: string): Promise<string | null> {
    const filename = this.path(key);
    try {
      return safeStorage.decryptString(await readFile(filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new DomainError('STORAGE_UNAVAILABLE', 'Secure credentials could not be read.');
    }
  }
  async set(key: string, value: string): Promise<void> {
    const filename = this.path(key);
    if (value.length > 100_000)
      throw new DomainError('INVALID_INPUT', 'Credential value exceeds the supported bound.');
    await mkdir(this.directory, { recursive: true });
    await writeFile(filename, safeStorage.encryptString(value), { mode: 0o600 });
  }
  async remove(key: string): Promise<void> {
    const filename = this.path(key);
    try {
      await unlink(filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
