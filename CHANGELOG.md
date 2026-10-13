# Changelog

## 0.1.0 — initial active desktop/backend slice

- Added strict pnpm monorepo contracts, pure exact arithmetic, application ports, reusable DOM presentation and isolated SQLite adapters.
- Added Electron bundled renderer, sandboxed narrow preload, database utility process, secure credentials and encrypted database export.
- Added independent local workspaces and transactional commercial/stock/dispatch commands with audit/idempotency.
- Added Supabase tenant schema, protected current roles/scopes, checked RPCs, independent release, invitations and ownership protections.
- Added public landing/shared browser presentation with real worker OPFS persistence and writer exclusion.
- Preserved the handoff and documented full scope and pending gates. Mobile draft source is deferred by the owner and excluded from active validation.
- Added durable identity/plant-bound pending command recovery, offline team write blocking, validated response DTOs, reusable account security and backup dialogs, and scoped plant selection.
- Protected referenced item interpretation and NCR containment, corrected exact revision handling beyond the JavaScript safe-number range, and reconciled actual WIP/vendor custody.
- Kept consumption/output, NCR closure and export disabled where the complete integrity slice remains pending. Added Auth/HTTP, ownership/MFA/archive and packaged Electron acceptance checks.
- Added minimal scoped order/PO projections for Stores and Dispatch, retaining commercial-field restrictions and supplier references in immutable receipt audit evidence.
- Made encrypted desktop exports flush temporary ciphertext before atomic replacement; failure tests preserve the previous backup and remove partial files.

- Added validated desktop snapshot preview and explicit activation through a managed selector, retaining previous database bytes and the original restore token after restart. Corrupt/unresolved recovery journals block local writes.

This version is not the completed M0–M10 ERP or a certified factory rollout. Feature-level acceptance status is recorded in features.md and docs/testing.md.

### Team concurrency integrity continuation

- Fixed a queued command committing after membership revocation by holding shared company/current-membership locks across authorization and business commit.
- Preserved the public RPC and checked transaction delegate; removed all client grants on the unlocked implementation.
- Added deterministic real PostgreSQL multi-session contention/retry/revision/access/MFA acceptance with guarded disposable-database cleanup, wired into `test:db` and existing CI.

### Local startup integrity continuation

- Made first SQLite schema/version creation atomic and checked existing metadata before DDL.
- Rejected unsupported, damaged and unversioned databases without recreating missing history; six real SQLite cases prove unchanged bytes and rollback/retry.

### Company setup recovery continuation

- Added strict company setup contracts, a reusable controller and account/backend-scoped durable journal with device writer exclusion.
- Retained original requests across restart and uncertain retries, pinned verified account tokens, and validated company identifiers and definitive rollback responses.
- Separated committed company status from local cleanup or list refresh failures. Added thirteen focused tests, two browser fault flows and two real Auth/HTTP rollback checks.
- Kept Solo on SQLite and Team on Supabase PostgreSQL. No schema migration or synchronization was added.

### Team administration recovery continuation

- Added strict keyed invitation, member-access and plant commands with durable original-request recovery outside tenant-dependent screens.
- Reused company setup's journal locks, confirmation handling and token verification; retained uncertain evidence after denied retries and kept returned invitation tokens transient.
- Blocked new Team writes/scope changes during unresolved administration; exposed corruption/quota recovery and preserved committed status across read/cleanup failure.
- Added thirteen shared tests, five browser administration fault flows, eleven real Supabase replay/audit/role assertions and three signed HTTP permission checks. Solo remains SQLite; no schema migration or synchronization was added.
