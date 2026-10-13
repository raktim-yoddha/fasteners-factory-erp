# Desktop database snapshot recovery

This is schema-v1 database-only recovery. Portable attachment archives, browser/mobile activation, scheduling, cloud backups and solo-to-team cutover remain pending.

## User flow

Export from solo workspace settings with a passphrase of at least 12 characters. The encrypted snapshot contains every device-local workspace, including ledger, audit and committed request results. Auth recovery cannot decrypt it.

From the local workspace selector choose **Restore encrypted snapshot**, enter the passphrase, and pick a `.fferp` file. Review the authenticated date, workspace identities/currency/timezone and exact record/lot/stock-event/audit counts. **Activate reviewed snapshot** selects a separate validated database. The previous database remains unchanged on disk. Workspaces absent from the snapshot remain in that retained previous database.

Pending business commands block restore. A durable restore journal retains the original activation token before dispatch. Lost acknowledgment shows **Confirmation unknown**; on restart the dialog opens automatically and **Retry original restore** confirms the persisted selection without importing again or overwriting subsequent writes. Corrupt/unavailable journals block local writes. Preview expires after 15 minutes; intervening writes require a fresh preview. Passphrases never enter journal storage.

## Validation

Main performs a bounded read of the native-picker-selected regular file. It rejects truncation/growth and unsupported encrypted envelope sizes/KDF costs, authenticates metadata and ciphertext, and verifies the database hash. Supported database size is at most 100 MiB. Plaintext stays in privileged memory until staging inside managed application storage.

The utility opens query-only memory with trusted schema disabled. Every schema object must match an initialized supported reference before business reads; unknown/changed tables, indexes, triggers and views are rejected. It checks the schema version/checksum, standalone journal headers, SQLite integrity and foreign keys. Limits are 500 workspaces and 250,000 total rows; exceeding them rejects activation explicitly.

Domain validation checks record kinds/states/references, exact revisions and decimals, nonnegative physical/referenced custody, item conservation, reservations against stock/demand, package/shipment/return reconciliation, genealogy scope, inspection results and released-stock evidence, NCR containment, and matching audit/idempotency outcomes. This validates the supported existing-stock/custody slice. It does not certify unimplemented production/disposition or make imported local provenance into trusted cloud identity.

## Selection and operations

The original database is `solo/factory-solo.sqlite3`. Candidates are privileged-generated `solo/restored-<uuid>.sqlite3` files. A strict versioned `solo/active-database.json` contains the selected basename and original token. Traversal, symlinks, missing selected files and corrupt metadata block startup without fallback.

Activation flushes and revalidates candidate bytes, quiesces the old connection, and atomically replaces a flushed adjacent selector. A failure before selection reopens the old database. A crash before selection leaves an unselected candidate; a crash after selection opens the validated candidate. Prior selections and interrupted candidates are not automatically pruned.

Preserve the complete user-data directory when recovery is needed. Live/retained databases remain OS-protected plaintext. The UI restores encrypted snapshots; reviewed export/activation of retained raw databases is a remaining operations feature. Older development binaries do not understand this selector and must not operate on the profile after activation. Update/binary rollback compatibility remains a release gate.

See [testing.md](testing.md), [features.md](../features.md) and [TASK-0007](tasks/TASK-0007-desktop-snapshot-restore.md) for evidence and remaining scope.

Startup now checks supported explicit schema objects and the stored version/checksum before DDL. An unsupported/damaged/unversioned existing database remains byte-identical after rejection; a failed first initialization rolls back all created objects and its version. Keep rejected bytes for reviewed recovery. Startup checks names/types/version; encrypted restore additionally validates complete schema SQL and supported domain data.
