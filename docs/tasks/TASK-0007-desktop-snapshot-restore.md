# Validated desktop database snapshot restore

Owner-approved M2/M9 recovery work, continued on 2026-10-13. Desktop remains first; mobile remains excluded.

## Scope and design

The current encrypted envelope contains all device-local workspaces in a standalone schema-v1 SQLite database. Implement desktop preview and explicit activation for this exact format. Do not claim portable attachment archives, cross-runtime restore, cloud cutover or scheduled backup delivery.

The main process owns a native file picker and bounded encrypted-file reading/decryption. The SQLite utility process validates the database in isolated memory against the exact supported schema, integrity/foreign keys, exact domain representations, immutable schema protections and supported stock/custody obligations. Preview reports date, identified workspaces and exact record/event counts. Passphrases and plaintext never enter renderer state beyond the entered passphrase and never appear in logs.

Activation writes and flushes a separate managed database, validates it before selection, and atomically selects it through a versioned managed pointer. The old database remains intact for recovery. A failed activation retains the old selection; a crash before selection leaves only an unselected candidate, while a crash after selection opens the verified candidate. No destructive file replacement or automatic cloud synchronization occurs.

Only the newest utility-owned preview token may activate, within a bounded lifetime and before any intervening local mutation. The selector UI blocks recovery if pending requests cannot be inspected or remain unresolved. Existing workspaces/IDs, ledger, audit, idempotency and local actor provenance are preserved. Restoring an older point does not make cloud identities or independent review trustworthy.

## Interfaces and validation

Add typed preview/activate/cancel application recovery ports and narrow preload methods. Reuse existing dialogs, fields, buttons, exact arithmetic, local schema and encrypted envelope. Managed filenames come from privileged random IDs; renderer inputs never supply file paths or SQL.

Test actual SQLite round trips, incompatible/extended schemas, missing references, non-exact values, negative or over-reserved custody, malformed cached outcomes, stale previews, interrupted candidate/pointer writes, reopening and old-data preservation. Exercise the Electron picker/preview/activation/relaunch path with fictional SAMPLE data. Run typecheck, lint/contract checks, affected tests and builds before each completed change is locally committed.

## State

Implementation complete for the desktop database-only slice. Validation: strict typecheck, lint/contracts and production web build; 44 tests across 7 files including 18 new restore cases; browser persistence acceptance; Electron and packaged executable preview/activation/restart acceptance. The dated restore evidence records the unsigned installer identity. Complete M9 portable attachment/cross-runtime restore, retained raw-file recovery UX, binary rollback compatibility, cutover and real device/production recovery remain pending.
