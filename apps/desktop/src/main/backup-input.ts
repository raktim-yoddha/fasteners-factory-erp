import { open } from 'node:fs/promises';
import { DomainError } from '@fasteners/contracts';

export async function readBackupFile(filename: string): Promise<Uint8Array> {
  const file = await open(filename, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 100 || stat.size > 200 * 1024 * 1024 + 4096)
      throw new DomainError(
        'BACKUP_INVALID',
        'Choose a regular encrypted snapshot within the supported size limit.',
      );
    const bytes = new Uint8Array(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await file.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead === 0)
        throw new DomainError('BACKUP_INVALID', 'The snapshot changed while it was being read.');
      offset += result.bytesRead;
    }
    if ((await file.read(new Uint8Array(1), 0, 1, offset)).bytesRead !== 0)
      throw new DomainError('BACKUP_INVALID', 'The snapshot changed while it was being read.');
    return bytes;
  } finally {
    await file.close();
  }
}
