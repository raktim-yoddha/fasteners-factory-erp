# Security and Authority Boundaries

The engineering contract is AGENTS.md. This document explains enforcement and proof without adding alternate rules.

## Trusted boundaries

Electron renderer is unprivileged. Preload exposes fixed methods, validates sender/frame in main, and cannot forward arbitrary SQL, filesystem paths or shell commands. Utility SQLite owns transactions; OS dialogs determine authorized backup destinations. The custom protocol only serves files contained in the compiled renderer root. Unexpected navigation, permissions and window creation are denied or allowlisted.

Cloud clients contain a publishable key and authenticated session. Private RPC helpers derive `auth.uid()`, recheck protected current membership/action/plant, and use fixed search paths and deliberate execution grants. Tables have RLS and clients have no mutation grants. Views/read projections cannot bypass membership. Editable user metadata never authorizes operations.

Role and invite changes protect Owner, delegation scope, verified matching email and stale inviter authority. Independent review compares real inspector identity. Company MFA policy is checked in trusted SQL. Operator read rules restrict assigned work and exclude commercial kinds.

## Data handling

Exact decimals remain text/NUMERIC. Ledger/audit are append-only and tenant references are composite. Idempotency replay requires current authorization and identical fingerprint. Client errors use stable codes and avoid raw SQL or hidden records. Logs must omit tokens, passwords, complete customer files and connection strings.

Local audit cannot resist a device administrator. Live SQLite is OS-protected, not advertised as encrypted at rest. Backups use fresh salt/nonce, PBKDF2-HMAC-SHA256 and authenticated AES-256-GCM; format/KDF/size/hash checks reject bad envelopes before any activation. Current database-only exports are not full attachment recovery.

## Pending proof

Broader forged-frame/path/navigation tests, credential corruption and callback tests, bounded private-file policies, MFA recovery/device loss, explicit export authorization/audit, complete portable attachment recovery and clean-machine checks remain release gates. Existing tests prove specific boundaries, not universal security certification.

## Current measured proof

A second Electron window with the same preload and bundled URL cannot borrow the primary window's IPC authority. Renderer `require` and `process` are absent. Pending business requests are retained before dispatch in identity/authority-bound web storage and restored after restart. Journal corruption or quota failure prevents a new dispatch. This journal is a local business record and is not advertised as encrypted at rest; Auth credentials remain in OS-backed storage on Electron.

Malformed or foreign successful RPC replies become Confirmation unknown. Offline team mutation is blocked. SQL tests verify plant/grant escalation rejection, current membership revocation and required MFA on accepted ownership transfer. Actual signed MFA challenges, full private Storage policies, and hostile-path/credential-corruption expansion remain separate gates.

Desktop recovery allowlists every schema object before business reads with trusted schema disabled. Integrity, foreign-key, exact-value, custody, obligation and audit/idempotency checks precede activation. A privileged managed selector commits only after the candidate is flushed and revalidated; old bytes are retained. Original-token retry resolves lost acknowledgment, and invalid journal/selector state fails closed. No backup-provided SQL, renderer-supplied paths or extension-loading API is exposed.
