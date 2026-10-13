# Cloud Backend and Operations

This document describes cloud implementation; it is not a second engineering contract or a replacement for CLAUDE.md.

## Environments and configuration

Use separate Supabase projects for development, staging and production, with companies inside each project. The local project `fasteners-factory-erp-desktop` uses ports 55321/55322/55324 and is isolated from sibling projects. Auth email verification is enabled, anonymous sign-in is disabled, refresh rotation remains supported, and local mail is captured rather than sent externally. Optional Studio, analytics, Realtime and Edge runtime are disabled in the current local slice.

Clients contain only a publishable key and project URL. Credentials, SMTP, secret/service-role keys, signing material and recovery secrets are runner/server inputs. Electron refresh credentials use OS secure storage via the main process, not renderer localStorage. Browser uses the official PKCE Auth flow. Callback/deep-link hardening, recovery UX and production mail configuration remain explicit acceptance items.

## Trusted API and tenant controls

Current RPC surfaces include verified `create_company`, membership-filtered `list_workspaces`, scoped `workspace_snapshot`, `execute_command`, hashed-token invitation/acceptance, `member_admin_snapshot`, idempotent `update_member_access`, plant creation and Owner-controlled policy/archive/accepted ownership transfer.

All public data tables use RLS and explicit read grants. Clients cannot directly mutate membership, roles, business state, stock ledger or audit. Public invoker RPC facades call checked private helpers; helper execution is limited deliberately. Functions use fixed search paths. Composite relationships prevent tenant/plant substitution. Current protected memberships and permission bundles—not JWT role metadata—decide each privileged command and replay.

Owner cannot be demoted through member administration or invitation acceptance. Ownership transfer names an active verified recipient and requires acceptance. Role delegation cannot exceed current rights/scope. Independent release rejects an inspector's own review even when roles are combined. Optional company MFA policy requires server AAL2 for mutations; hiding a prompt is not enforcement.

## Schema and development workflow

Migrations are created by the pinned CLI, applied locally and retained immutably. Applied fixes use later migrations. `pnpm db:types` generates public schema types; do not hand-edit them. Business DTOs remain separate. SQL regression records are fictional and rolled back after the test transaction. No remote reset or production seeding is part of development commands.

Use `pnpm db:start`, `pnpm test:db`, `pnpm db:types`, and documented CLI `--help` when command syntax changes. The wrapper captures runtime credentials instead of printing them. Do not paste secret CLI output into issues, docs or app diagnostics.

## Pending operational breadth

Private document upload/staging/finalization, account-owned encrypted cloud backup buckets, signed bounded download policies, advanced reporting exports, asynchronous notifications, restore drills, reviewed atomic cutover and production monitoring are later slices. No empty Edge Function or public storage bucket is presented as implemented recovery.

Hosted database backups must be paired with private Storage bytes; database backup alone is not attachment recovery. Restore to isolated staging and verify RLS, memberships, ledger and files together. Real SMTP, schedules, hosting, publication and signed release activation require owner-controlled deployment inputs.

Current TLS checkpoint: Supabase announced retirement of older TLS 1.2 cipher suites on 2026-11-10. The selected modern runtimes must be verified against the deployed HTTPS backend before production. Local HTTP test success does not prove hosted TLS compatibility.

## Executed development checkpoint

The real PostgreSQL regression suite passes 69 assertions for tenant isolation, roles/grants, plant scope, immutable item/NCR references, independent review, idempotency, atomic failure, current membership revocation, MFA policy, accepted ownership transfer and archive behavior. The local signed Auth/HTTP suite passes 13 checks, removes its fictional identities, and creates no company data. These checks do not replace full signed multi-role UI, wider administration contention or deployed recovery acceptance.

RPC response DTOs are validated before rendering or recognizing a commit. Team critical writes return `OFFLINE_TEAM_WRITE_BLOCKED` when offline. Unknown business confirmation retains its original durable request. Company-creation transport recovery is implemented in the current shared client slice; remaining administration transport and recovery/deep-link expansion are broader M1 acceptance items. CLI security advisors reported no warnings/errors for the local schema; private file/backup Storage delivery is still pending.

## Concurrent authority acceptance

Migration `20261013150048_command_authority_locks.sql` holds shared company and current actor-membership locks throughout each business command, with the existing per-plant stock lock and atomic request/ledger/audit transaction retained. Access administration already locks the company before its target membership update. The public invoker facade calls a checked private wrapper; its unlocked delegate is explicitly non-executable by clients.

`pnpm test:db` runs 69 rollback-contained authority assertions followed by 15 real multi-session concurrency assertions. `pnpm test:db:concurrency` runs only the latter. Its strictly named, marker-verified temporary database copies no business/Auth rows: it imports Auth schema only and replays all product migrations. The fixture refuses other databases; cleanup closes owned sessions and drops only its verified temporary database. It exercises two actors, exact stock contention, duplicate retries, stale revisions, pending membership/role changes and company MFA policy. These SQL claim-context fixtures do not claim signed MFA/device/UI acceptance. Hosted infrastructure remains untouched.

## Company creation response handling

Supabase provides the Team PostgreSQL database; SQLite remains the independent Solo engine. Company setup calls the existing `create_company` RPC with a captured, server-verified account token and durable request key. The returned identifier must be a UUID. Only the known PostgreSQL `P0001` rollback messages with HTTP 400 are classified as definitive rejections; transport/proxy/unrecognized/malformed outcomes remain unknown. Local Auth/HTTP acceptance verifies the actual rejection response and absence of membership after an invalid timezone request. It creates no company fixtures.

The account/backend-origin journal is retained when an earlier uncertain attempt cannot be disproved by a later rejection. Web Locks prevent competing windows replacing the original request. Loss of local journal bytes is not account-level disaster recovery; wider recovery and administration commands remain pending. No migration or public schema/type change was required by this continuation.

## Keyed administration checkpoint

The client administration executor uses the existing `invite_member`, `update_member_access` and `create_plant` RPCs. Verified token binding and response/error classification are shared with company setup. Invitation and plant responses require their expected identifiers; member update requires the intended empty success response. Malformed/proxy/unrecognized outcomes remain unknown. No migration or generated schema-type edit was needed.

The real authority suite now adds eleven checks for original invitation identifiers/tokens, one-time plant/warehouse creation, member role preservation, changed-key rejection and unchanged audit history on retries/failures. Actual signed HTTP adds three nonmember permission rollback checks. The concurrency suite still covers the business-command slice; concurrent administration/ownership/deadlock and complete signed UI/MFA acceptance remain pending. The HTTP fixture creates no tenant records, and database business fixtures are rolled back or removed with their owned temporary database.
