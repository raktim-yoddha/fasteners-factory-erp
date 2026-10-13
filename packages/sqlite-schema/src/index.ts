export type SqlValue = string | number | null;
export type SqlRow = Record<string, SqlValue>;
export function normalizeSqlRows(rows: Record<string, unknown>[]): SqlRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (typeof value === 'bigint') return [key, value.toString()];
        if (value === null || typeof value === 'string') return [key, value];
        if (
          typeof value === 'number' &&
          Number.isFinite(value) &&
          (!Number.isInteger(value) || Number.isSafeInteger(value))
        )
          return [key, value];
        throw new Error(
          'SQLite returned an unsupported value or an integer without exact precision.',
        );
      }),
    ),
  );
}
export interface SqlExecutor {
  run(sql: string, parameters?: SqlValue[]): Promise<void>;
  all(sql: string, parameters?: SqlValue[]): Promise<SqlRow[]>;
}
export interface SqlDriver extends SqlExecutor {
  transaction<T>(operation: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export const schemaVersion = 1;
export const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL, timezone TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), kind TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, fields TEXT NOT NULL CHECK(json_valid(fields)), created_at TEXT NOT NULL, UNIQUE(workspace_id,kind,code), UNIQUE(workspace_id,id));
CREATE TABLE IF NOT EXISTS lots (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), code TEXT NOT NULL, item_id TEXT NOT NULL, location TEXT NOT NULL, qc_state TEXT NOT NULL CHECK(qc_state IN ('held','released')), revision INTEGER NOT NULL DEFAULT 1, UNIQUE(workspace_id,code), UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,item_id) REFERENCES records(workspace_id,id));
CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, lot_id TEXT NOT NULL, quantity TEXT NOT NULL CHECK(typeof(quantity)='text'), custody TEXT NOT NULL CHECK(custody IN ('stores','wip','vendor','consumed','shipped','loss')), reference_id TEXT NOT NULL, event TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(workspace_id,lot_id) REFERENCES lots(workspace_id,id));
CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, lot_id TEXT NOT NULL, order_id TEXT NOT NULL, quantity TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('active','released','dispatched')), UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,lot_id) REFERENCES lots(workspace_id,id), FOREIGN KEY(workspace_id,order_id) REFERENCES records(workspace_id,id));
CREATE TABLE IF NOT EXISTS inspections (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, lot_id TEXT NOT NULL, lot_revision INTEGER NOT NULL, lower_limit TEXT NOT NULL, upper_limit TEXT NOT NULL, readings TEXT NOT NULL, unit TEXT NOT NULL, passed INTEGER NOT NULL CHECK(passed IN (0,1)), actor TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(workspace_id,lot_id) REFERENCES lots(workspace_id,id));
CREATE TABLE IF NOT EXISTS packages (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, code TEXT NOT NULL, reservation_id TEXT NOT NULL, lot_id TEXT NOT NULL, order_id TEXT NOT NULL, quantity TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('verified','dispatched')), UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,reservation_id) REFERENCES reservations(workspace_id,id), FOREIGN KEY(workspace_id,lot_id) REFERENCES lots(workspace_id,id), FOREIGN KEY(workspace_id,order_id) REFERENCES records(workspace_id,id));
CREATE TABLE IF NOT EXISTS shipments (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, code TEXT NOT NULL, package_id TEXT NOT NULL UNIQUE, lot_id TEXT NOT NULL, order_id TEXT NOT NULL, quantity TEXT NOT NULL, carrier TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,package_id) REFERENCES packages(workspace_id,id), FOREIGN KEY(workspace_id,lot_id) REFERENCES lots(workspace_id,id));
CREATE TABLE IF NOT EXISTS genealogy (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, parent_lot_id TEXT NOT NULL, child_lot_id TEXT NOT NULL, reference_id TEXT NOT NULL, quantity TEXT NOT NULL, FOREIGN KEY(workspace_id,parent_lot_id) REFERENCES lots(workspace_id,id), FOREIGN KEY(workspace_id,child_lot_id) REFERENCES lots(workspace_id,id));
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), command TEXT NOT NULL, entity_id TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency (workspace_id TEXT NOT NULL REFERENCES workspaces(id), actor TEXT NOT NULL, command TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)), PRIMARY KEY(workspace_id,actor,command,request_key));
CREATE INDEX IF NOT EXISTS records_scope ON records(workspace_id,kind,created_at);
CREATE INDEX IF NOT EXISTS ledger_scope ON ledger(workspace_id,lot_id,custody,reference_id);
CREATE INDEX IF NOT EXISTS audit_scope ON audit(workspace_id,created_at);
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS engineering_immutable BEFORE UPDATE ON records WHEN OLD.kind='engineering' AND OLD.state='approved' BEGIN SELECT RAISE(ABORT,'approved engineering is immutable'); END;
`;
