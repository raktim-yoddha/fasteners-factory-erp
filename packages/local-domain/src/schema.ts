import { DomainError } from '@fasteners/contracts';
import { schema, schemaVersion, type SqlDriver } from '@fasteners/sqlite-schema';

export const schemaChecksum = 'fasteners-sqlite-v1-core-2026-10-13';
const expectedObjects = [...schema.matchAll(/CREATE (TABLE|INDEX|TRIGGER) IF NOT EXISTS (\w+)/g)]
  .map((match) => `${match[1]!.toLowerCase()}:${match[2]!}`)
  .sort();

export async function initialize(driver: SqlDriver): Promise<void> {
  await driver.run('PRAGMA foreign_keys = ON');
  await driver.transaction(async (db) => {
    const objects = await db.all(
      "SELECT type,name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
    );
    if (objects.length) {
      const actual = objects.map((object) => `${object.type}:${object.name}`).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expectedObjects))
        throw new DomainError(
          'SCHEMA_INCOMPATIBLE',
          'Local schema objects are missing, unversioned or unsupported. Preserve the database for recovery; no repair was attempted.',
        );
      const versions = await db.all('SELECT * FROM schema_versions');
      if (
        versions.length !== 1 ||
        String(versions[0]!.version) !== String(schemaVersion) ||
        versions[0]!.checksum !== schemaChecksum
      )
        throw new DomainError(
          'SCHEMA_INCOMPATIBLE',
          'This local schema version/checksum is unsupported. The database has not been changed.',
        );
      return;
    }
    await db.run(schema);
    await db.run('INSERT INTO schema_versions(version,checksum) VALUES(?,?)', [
      schemaVersion,
      schemaChecksum,
    ]);
  });
}
