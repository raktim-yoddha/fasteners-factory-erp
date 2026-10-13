# Fasteners Factory ERP — engineering contract

The owner-approved handoff in `docs/handoff.md` and root PRD define product scope. This file is the sole engineering rule hub; CLAUDE.md must be byte-identical.

## Authority and integrity

- Solo is an independent device-local SQLite workspace. Team is Supabase. Never automatically synchronize them or fall back to solo for team writes.
- Success means an authority transaction committed. Unknown transport outcomes retain the idempotency key.
- Store exact domain decimals as text locally and NUMERIC in PostgreSQL. No floating point quantities, prices, or measurements.
- Stock and audit are append-only. Corrections require compensating events. Approved engineering is immutable.
- Derive actors from trusted identity/provenance. Current membership, permission and plant scope enforce cloud access. No user_metadata authorization.
- Every enabled action requires a real implementation and tests. Unavailable actions show a reason. Never claim missing runtime, device, signing or production evidence passed.

## Boundaries

- Presentation calls application ports; adapters own runtime APIs; domain stays pure.
- Electron renderer has no Node access. Preload exposes only validated individual operations. Database utility process owns SQLite.
- Native mobile uses native components and serialized exclusive SQLite transactions. Browser SQLite runs in an OPFS worker with one writer.
- Privileged cloud commands run atomically in PostgreSQL. Direct client business-table writes are forbidden. All exposed tables require RLS and intentional grants.
- Never bundle cloud secrets or log tokens. SAMPLE fixtures contain fictional records only.

## Work and validation

- Active priority is Electron desktop, then the multi-person backend. Mobile drafts remain excluded from active workspaces, builds and checks until the owner resumes them.

- Keep changes inside this project. Preserve sibling work and parent Git configuration. Do not force push, bypass hooks, or reset remote data.
- Record task scope, interfaces, validation and remaining gates in docs/tasks before changes. Update owning documentation with behavior changes.
- Pin exact dependencies and commit one pnpm lockfile. Generate database types; never hand-edit them.
- Work directly without subagents, as requested by the owner. Reuse shared components, controllers and contracts. Keep files focused and avoid duplicate behavior.
- Run typecheck, lint, focused invariant tests and affected runtime checks. Cross-authority/runtime parity requires actual evidence.
- Production hosting, real external messages, paid resources, store publication and signed public release require owner authorization. Local reversible implementation is already authorized.
- No Ponytail skills/mode. Concise chat; normal prose in persisted documentation.
