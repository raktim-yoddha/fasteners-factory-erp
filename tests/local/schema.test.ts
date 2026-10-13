import { expect, it } from 'vitest';
import { DesktopSqlDriver } from '../../packages/sqlite-desktop/src';
import { initialize, LocalRepository } from '../../packages/local-domain/src';
import type { SqlDriver } from '../../packages/sqlite-schema/src';

it.each(['future-version', 'checksum', 'missing-audit', 'unexpected-object', 'unversioned'])(
  'preserves incompatible database bytes before any DDL: %s',
  async (defect) => {
    const driver = new DesktopSqlDriver(':memory:');
    try {
      if (defect === 'unversioned') await driver.run('CREATE TABLE unknown_history(value TEXT);');
      else {
        await initialize(driver);
        await new LocalRepository(driver).createWorkspace({
          name: 'SAMPLE retained',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        });
        if (defect === 'future-version') await driver.run('UPDATE schema_versions SET version=2;');
        if (defect === 'checksum')
          await driver.run("UPDATE schema_versions SET checksum='SAMPLE different';");
        if (defect === 'missing-audit') await driver.run('DROP TABLE audit;');
        if (defect === 'unexpected-object')
          await driver.run('CREATE VIEW unexpected AS SELECT * FROM workspaces;');
      }
      const previous = await driver.exportDatabase();
      await expect(initialize(driver)).rejects.toThrow(/unsupported|missing|unversioned/);
      expect(await driver.exportDatabase()).toEqual(previous);
    } finally {
      await driver.close();
    }
  },
);

it('rolls back initial DDL and its version on a failed transaction, then initializes and reopens existing data safely', async () => {
  const driver = new DesktopSqlDriver(':memory:');
  const fault: SqlDriver = {
    run: (sql, parameters) => driver.run(sql, parameters),
    all: (sql, parameters) => driver.all(sql, parameters),
    close: () => driver.close(),
    transaction: (operation) =>
      driver.transaction((db) =>
        operation({
          all: (sql, parameters) => db.all(sql, parameters),
          run: async (sql, parameters) => {
            await db.run(sql, parameters);
            if (sql.includes('CREATE TABLE')) throw new Error('SAMPLE initial DDL failure');
          },
        }),
      ),
  };
  try {
    await expect(initialize(fault)).rejects.toThrow('initial DDL failure');
    expect(
      await driver.all("SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'"),
    ).toEqual([]);
    await initialize(driver);
    const repository = new LocalRepository(driver);
    const workspace = await repository.createWorkspace({
      name: 'SAMPLE retry',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    });
    const before = await driver.exportDatabase();
    await initialize(driver);
    expect(await repository.listWorkspaces()).toEqual([workspace]);
    expect(await driver.exportDatabase()).toEqual(before);
    expect(String((await driver.all('PRAGMA foreign_keys'))[0]!.foreign_keys)).toBe('1');
  } finally {
    await driver.close();
  }
});
