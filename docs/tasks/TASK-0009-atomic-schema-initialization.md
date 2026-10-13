# Atomic local schema initialization

Continue desktop-first M2 integrity. Existing `initialize` executes schema DDL before checking stored version/checksum; that can modify an unsupported database and recreate missing history tables. Correct the owning local service without changing schema-v1 data or interfaces.

Read metadata/version before DDL under a serialized transaction. An existing database must have the exact supported explicit object names/types and one matching version/checksum row. Reject missing/extra objects, unknown versions and unversioned existing tables without repair or replacement. Initialize an empty database and its version atomically. Enable connection foreign keys outside the transaction, because changing that pragma inside a transaction is ineffective.

Prove actual SQLite byte preservation for incompatible/damaged databases, no partial DDL/version after failure, successful retry on a genuinely empty database, and existing workspace persistence. Run shared/runtime gates and commit the completed slice. Version upgrades, portable attachment migration and binary downgrade remain separate work.

State: implementation and validation in progress.
