import { DomainError } from '@fasteners/contracts';
import { initialize, schemaChecksum, validateRecoveryData } from '@fasteners/local-domain';
import { DesktopSqlDriver } from '@fasteners/sqlite-desktop';

const schemaQuery = 'SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name';
const tables = [
  'schema_versions',
  'workspaces',
  'records',
  'lots',
  'ledger',
  'reservations',
  'inspections',
  'packages',
  'shipments',
  'genealogy',
  'audit',
  'idempotency',
];
export async function validateSnapshot(database: Uint8Array) {
  let candidate: DesktopSqlDriver | undefined;
  const reference = new DesktopSqlDriver(':memory:');
  try {
    if (
      database.length < 100 ||
      database.length > 100 * 1024 * 1024 ||
      database[18] !== 1 ||
      database[19] !== 1
    )
      throw new DomainError(
        'BACKUP_INVALID',
        'Restore requires a bounded standalone SQLite database without WAL sidecars.',
      );
    await initialize(reference);
    candidate = new DesktopSqlDriver(database, true);
    if (
      JSON.stringify(await candidate.all(schemaQuery)) !==
      JSON.stringify(await reference.all(schemaQuery))
    )
      throw new DomainError(
        'SCHEMA_INCOMPATIBLE',
        'The backup schema differs from the supported schema. No triggers or extensions were executed.',
      );
    const versions = await candidate.all('SELECT * FROM schema_versions');
    if (
      versions.length !== 1 ||
      String(versions[0]!.version) !== '1' ||
      versions[0]!.checksum !== schemaChecksum
    )
      throw new DomainError(
        'SCHEMA_INCOMPATIBLE',
        'The backup schema version or checksum is unsupported.',
      );
    let count = 0n;
    for (const table of tables) {
      const rows = await candidate.all(`SELECT COUNT(*) AS count FROM ${table}`);
      count += BigInt(rows[0]!.count!);
      if (count > 250_000n || (table === 'workspaces' && BigInt(rows[0]!.count!) > 500n))
        throw new DomainError(
          'BACKUP_INVALID',
          'The snapshot exceeds the supported restore row limits.',
        );
    }
    const integrity = await candidate.all('PRAGMA integrity_check');
    if (
      integrity.length !== 1 ||
      integrity[0]!.integrity_check !== 'ok' ||
      (await candidate.all('PRAGMA foreign_key_check')).length
    )
      throw new DomainError('BACKUP_INVALID', 'SQLite integrity or foreign-key validation failed.');
    return await validateRecoveryData(candidate);
  } catch (error) {
    if (
      error instanceof DomainError &&
      ['BACKUP_INVALID', 'SCHEMA_INCOMPATIBLE'].includes(error.code)
    )
      throw error;
    throw new DomainError(
      'BACKUP_INVALID',
      'The backup contains invalid or unsupported local data. Active data remains unchanged.',
    );
  } finally {
    await candidate?.close();
    await reference.close();
  }
}
