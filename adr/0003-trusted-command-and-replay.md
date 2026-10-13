# ADR 0003: Atomic trusted commands and idempotency

Date: 2026-10-13. Status: implemented initial slice.

Use a closed validated version-1 command contract with explicit authority, UUID request key, optional expected revision and decimal-text payloads. SQLite serializes real transactions; PostgreSQL uses narrow checked RPCs and conservative company/plant transaction locks. Domain state, ledger, audit and replay result commit together.

Matching key/payload returns the original result. Changed input fails. Cloud checks current membership/permission before replay. Transport uncertainty retains the original key. This deliberately favors correctness and inspectable invariants over an ORM, distributed synchronization or client-driven multiple REST writes.
