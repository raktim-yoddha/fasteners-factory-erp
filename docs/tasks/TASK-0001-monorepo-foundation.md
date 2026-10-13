# TASK-0001 — Monorepo and local authority foundation

## Scope and ownership

The primary agent owns root tooling; contracts/domain/application; SQLite schema/local-domain; web and Electron adapters/presentation; encrypted backup; and local/integration suites. Work proceeds directly without subagents. Cloud has a separate task record; native mobile is deferred. Preserve the source handoff unchanged.

## Interfaces and dependencies

Expose `Authority`, a closed version-1 command union, decimal-string DTOs, typed `CommandResult`, and the `Repository` port. SQLite adapters implement the private `SqlDriver` transaction interface. Presentation uses ports rather than direct SQL or runtime APIs. Electron has a validated preload boundary and utility-process database owner. Browser writes run in a locked OPFS worker.

The first schema uses generic business records and explicit lot, ledger, reservation, inspection, package, shipment, genealogy, audit and idempotency relations. It is not the full normalized engineering/procurement/production schema from the handoff.

## Validation and remaining gates

Run exact-value/state tests, actual native SQLite rollback/idempotency/custody tests, typecheck, lint, web build and relevant E2E. Test wrong-key/corrupt snapshot rejection without replacing good data. Browser OPFS, packaged Electron native-module ABI and mobile adapter parity require their own runtime evidence. Complete normalized BOM/routing, independent review policies, file lifecycle and all late milestones separately.

Current evidence is recorded in docs/testing.md: shared checks with 26 tests, browser OPFS acceptance, actual Electron persistence/IPC/export/retry acceptance, and bundled Windows executable proof passed. Full portable restoration, managed attachments, normalized engineering/production and mobile parity remain pending or deferred.
