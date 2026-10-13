# Task 0010 — Durable company setup confirmation

Prepared: 2026-10-13. Owner: primary agent. Milestone: M1. Status: scoped before implementation.

## Outcome and interfaces

Company creation must retain its exact input and request key across renderer restart when the server response is uncertain. A verified account owns the journal; another account cannot read or retry it. A storage failure blocks dispatch. The shared onboarding screen displays the original company details and an explicit retry action, prevents a replacement submission while unresolved, and reports a committed company separately from a failed company-list refresh.

Implement a strict versioned company-setup contract, an application controller, and a device storage adapter. Presentation uses these application ports; platform entry points supply the storage adapter. Reuse the existing PostgreSQL `create_company` atomic transaction and replay guard. Validate its successful UUID response and classify only recognized PostgreSQL rejections as definitive. Network errors, malformed replies and unexpected exceptions remain confirmation unknown.

Account verification happens before each dispatch. Offline or authentication failures before dispatch preserve any original unresolved request. Once an earlier attempt is uncertain, even a later permission rejection cannot prove that attempt never committed; retain its journal for recovery. Do not expose a discard action that could duplicate a company.

## Validation

- Controller and storage tests: restart replay, exact input/key preservation, account isolation, unverified identity, no send on storage failure, concurrent submission blocking, malformed confirmation, definitive initial rejection, uncertain retry rejection, and journal cleanup failure.
- Shared UI acceptance with deterministic transport faults: lost response, reload, immutable original retry, committed status, failed refresh, corrupted storage and identity switching. Keep simulated transport evidence separate from real database evidence.
- Existing real PostgreSQL suite proves company replay returns the original company and changed payload with the same key is rejected. Run it and local Auth/HTTP checks without creating persistent tenant fixtures.
- Typecheck, lint, shared tests, affected browser and Electron checks; rebuild the Windows artifact and record new checksums if packaging passes.

## Exclusions and remaining gates

This slice covers company creation only. Invitation, access, plant and ownership administration transport recovery remain pending. Multi-device account recovery, migration/cutover, signed clean-machine installer evidence and mobile remain pending. No schema change, hosted infrastructure, automatic push or real external mail is involved.
