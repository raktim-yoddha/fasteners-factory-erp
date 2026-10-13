# Task 0011 — Durable Team administration recovery

Prepared: 2026-10-13. Owner: primary agent. Milestone: M1. Status: scoped before implementation.

## Outcome and scope

Invitation creation, member-access changes and plant/warehouse creation must retain a strict versioned original request before dispatch. Retry after restart uses the same account, backend, company, fields and key. Unknown outcomes block replacement administration and business writes in the active Team session. Recovery remains available from the company picker and from an unavailable tenant screen, so revoked membership cannot hide the original request. A later denied retry preserves earlier uncertain evidence.

Reuse company setup's journal locking, confirmation handling and verified-token binding at their owning layers. Presentation calls an application administration controller; the Supabase adapter translates its typed command to the existing checked RPCs. Responses require intentional success shapes. An invitation's returned token is transient UI state, never persisted or logged. Committed status is independent of read refresh and local journal cleanup. Account switching clears displayed results while retaining the original account journal. Offline writes remain blocked. No automatic synchronization or Solo database change is involved.

## Acceptance

- Strict contracts reject malformed fields, actor/company substitution and unrecognized operations before dispatch.
- Shared tests prove all three original retries, storage corruption/quota, identity/backend isolation, writer exclusion, malformed responses, denied retry preservation, known rejection cleanup, and confirmed commit with failed cleanup.
- Browser fixtures exercise the actual shared administration UI/controller with lost responses, restart and access revocation; explicitly distinguish fictional transport evidence from backend evidence.
- Actual local Supabase tests prove duplicate invitations/member updates/plants commit once, changed requests reject and failed commands leave audit/history unchanged. Auth/HTTP verifies response classification and token binding without persistent company fixtures.
- Run typecheck/lint/shared gates, browser checks, packaged Electron regression and security advisors. Record exact executed results and package identity; do not claim signed-in desktop Team/MFA, clean-machine signing or production acceptance.

## Exclusions

Ownership transfer, archive and policy changes currently use a separate non-keyed API; their durable transport redesign is a later slice. Invitation acceptance/recovery links, email delivery, private files, manufacturing breadth and cutover remain pending. Mobile is excluded. No hosted changes, new dependencies or Git push are part of this task. Existing migrations remain immutable; no schema change is anticipated.
