# TASK-0004 — Documentation and validation contracts

## Scope and ownership

The primary agent owns canonical root README/PID/PRD/architecture/design/features/cloud/CHANGELOG; supporting docs except immutable handoff; ADRs; GitHub workflows; and `scripts/validation/contracts.mjs`. Work proceeds directly without subagents.

## Inputs and interfaces

Preserve `docs/handoff.md`, prepared 2026-10-13, SHA-256 `339E0548B9481DDF8B900220129173A408B92D881CBF9FFCBE874257E7CDDAAB`. Describe current generic-record implementation separately from full target requirements. Record all 16 stages and 17 role templates. CI calls existing root commands; contract validation checks agent byte equality, immutable source checksum, neutral-domain import boundaries, client secret patterns and exact manifest pins.

## Acceptance and evidence

The contract validator is integrated and passed: agent equality, preserved handoff hash, exact manifest versions, package import boundaries, client credential boundaries, and mobile deferral. Active CI calls the real shared, PostgreSQL, Auth/HTTP, browser and Windows package commands. Hosted GitHub execution remains pending project-root or explicit parent CI integration; no hosted CI result is claimed locally.
