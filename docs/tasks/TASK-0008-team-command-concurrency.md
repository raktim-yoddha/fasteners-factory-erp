# Current team authority under concurrent commands

Continue the approved multi-person backend gates after desktop restore. Mobile remains excluded.

## Scope and design

Prove real competing reservations, duplicate retries and stale revisions through separate authenticated PostgreSQL sessions. Investigate membership/grant changes while a command is waiting. Business commands must hold a shared company and current actor-membership lock across authorization and mutation, so archive/MFA changes and membership/grant changes cannot overtake a command's authorization. Public RPC signatures and current business transactions remain unchanged.

Use a subsequent CLI-generated migration if regression evidence requires the lock guard. Preserve existing migrations and data, retain the older implementation behind a private non-executable delegate, and keep current trusted identity, plant checks and idempotency behavior. Administration transport recovery and full administration concurrency remain separate tracked work.

## Test isolation

The harness copies only the local Auth schema and replays product migrations into a fresh, strictly named disposable database inside this project's local Supabase database container. No business/Auth data is copied. Create fictional verified identities and one SAMPLE company in the clone, execute real transactions with authenticated role/JWT claim context, then terminate only owned test sessions and drop only the freshly created, marker-verified database. Do not reset the local source, use remote databases or touch sibling containers. This evidence is database-session authorization, not a claim of signed browser/MFA/device acceptance.

## Acceptance

Commands commit once under duplicate retries. Competing requests cannot oversell and stale revisions commit nothing. A command waits for a pending membership/grant update and rejects after revocation commits. Schema clone and cleanup work in the local container; protected private delegates cannot be called directly by clients. Run real PostgreSQL and Auth/HTTP suites, regenerate types, update documentation/CI/root commands and make a focused local commit.

## State

Implemented and validated. Before the fix, the deterministic queued-command probe committed after membership revocation had already committed. Migration 20261013150048 adds transaction-held company/current-membership locks and revokes direct access to the unlocked private delegate. The disposable replay now passes 15 concurrency assertions; the actual local database passes 58 authority assertions and 8 Auth/HTTP checks. Security advisors report no warnings/errors; generated public types are unchanged. Root test:db and existing CI now run both suites. Full manufacturing, wider administration concurrency/transport and factory/device acceptance remain pending.
