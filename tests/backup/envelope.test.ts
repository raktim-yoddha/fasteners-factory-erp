import { expect, it } from 'vitest';
import { DesktopSqlDriver } from '../../packages/sqlite-desktop/src';
import { initialize } from '../../packages/local-domain/src';
import { decryptDatabase, encryptDatabase } from '../../packages/backup/src';
it('encrypts a consistent SQLite snapshot and rejects wrong password, corruption and unbounded KDF costs', async () => {
  const driver = new DesktopSqlDriver(':memory:');
  await initialize(driver);
  const database = await driver.exportDatabase();
  await driver.close();
  const passphrase = 'SAMPLE recovery passphrase';
  const encrypted = await encryptDatabase(database, passphrase);
  expect((await decryptDatabase(encrypted, passphrase)).database).toEqual(database);
  await expect(decryptDatabase(encrypted, 'SAMPLE wrong password')).rejects.toThrow(
    'authentication',
  );
  const envelope = JSON.parse(new TextDecoder().decode(encrypted)) as {
    header: { iterations: number };
    ciphertext: string;
  };
  envelope.header.iterations = 99_999_999;
  await expect(
    decryptDatabase(new TextEncoder().encode(JSON.stringify(envelope)), passphrase),
  ).rejects.toThrow('validation');
  const corrupted = encrypted.slice();
  const index = corrupted.length - 10;
  corrupted[index] = corrupted[index]! ^ 1;
  await expect(decryptDatabase(corrupted, passphrase)).rejects.toThrow();
});
