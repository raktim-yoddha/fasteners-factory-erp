# Team administration recovery acceptance — 2026-10-13

Environment: Windows 11 x64 and the repository's pinned workspace toolchain. Desktop and multi-person Supabase work are active; mobile remains excluded. This is scoped delivery evidence, not completion of M1 or M0–M10.

## Delivered slice

Invitation creation, member-access changes and plant/warehouse creation use strict versioned original requests through the shared application administration controller. The client retains account, backend, original company, operation, fields and key before dispatch. The shared journal and writer lock prevent replacement. Company setup reuses the same journal/confirmation/token helpers and retains its existing namespace and serialized request shape.

The adapter verifies and pins the original account token for each existing Supabase RPC. Intentional response shapes are validated. Unknown/malformed/transport outcomes remain retained, including when a later retry is denied. Confirmed commits remain distinct from failed journal cleanup or read refresh. Returned invitation tokens are transient confirmed-result UI state and are never saved in request journals or logged.

The shell recovery panel remains reachable without a readable tenant or active company-list entry. New Team writes and scope changes are blocked while administration is pending, active or storage is invalid. Account switching removes displayed results/token state while preserving its original journal. Corruption and quota failures provide a recheck action. Solo remains device-local SQLite; no synchronization, schema migration, generated database type change or dependency update was made.

## Executed gates

| Command                                    | Result                      | Evidence and limits                                                                                                                                                                                                                                         |
| ------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                               | Passed                      | Strict typecheck, ESLint/engineering checksum/equality/pin/import checks, 76 tests across 10 files and production web build                                                                                                                                 |
| Administration-focused shared suite        | 13 tests passed             | Three exact original retries, account/backend isolation, denied/offline retry retention, malformed input/results, storage corruption/quota, writer exclusion, verified token binding and committed cleanup failure                                          |
| Existing company setup shared suite        | 13 tests passed             | Reused durability/token/storage helpers preserve the established company flow                                                                                                                                                                               |
| `pnpm test:db`                             | 84 assertions passed        | 69 rollback-contained local Supabase authority assertions, including 11 additional invitation/plant/member replay, changed-input and audit/role-preservation checks; 15 real multi-session business concurrency assertions in a guarded disposable database |
| `pnpm test:api`                            | 13 checks passed            | Actual local Auth password JWT/current identity and denials; three additional signed administration permission rollback checks. Fictional users removed; no company/tenant records created                                                                  |
| `pnpm e2e:web`                             | 8 flows passed              | Existing OPFS and two company flows, plus five administration UI/controller fault flows: invitation/revocation/transient token, plant restart, member access restart, corrupt journal and quota preflight                                                   |
| `pnpm --filter @fasteners/desktop package` | Passed                      | Native rebuild, bundled assets and Windows x64 NSIS artifact                                                                                                                                                                                                |
| `pnpm e2e:desktop:packaged`                | 1 flow passed, 35.7 seconds | Real bundled Electron/native SQLite, secure-origin writer lock, renderer isolation, forged IPC denial, encrypted export, restore/restart and retained unknown-confirmation regression                                                                       |
| Local Supabase security advisors           | No issues                   | `supabase db advisors --local --type security --level warn --fail-on warn`                                                                                                                                                                                  |

Browser administration transport fixtures are explicitly fictional development-only source entries, excluded from the production build entry graph. Their simulated commit state is UI/controller evidence. Real Supabase database assertions separately prove one-time authority results and unchanged audit/roles after duplicate or changed requests. The packaged Electron flow proves local regression and the writer-lock prerequisite, not a signed-in desktop Team/MFA workflow.

## Current artifact

The installer is **NotSigned**. Signed release, clean-machine installation, hosted TLS, updater compatibility and production restore acceptance remain pending.

```text
0f48fc945948779f2357dbde26691d40fc4227dd0d265d35c28276f44528fbed  Fasteners Factory ERP Setup 0.1.0.exe
8d472be017974301c5bb6814d74eabd03aa8fb56e6ef3caafa38e1ebc994c7bd  Fasteners Factory ERP Setup 0.1.0.exe.blockmap
```

Artifacts and checksums remain under ignored `apps/desktop/release`. No runtime/build files, credentials, real mail, hosted writes or Git push are included in this continuation.

## Remaining gates

Ownership/archive/policy transport recovery uses a separate non-keyed API and is pending. Wider server administration contention/deadlock, complete signed desktop Team/MFA and invitation/link/device recovery also remain pending. Full immutable engineering/files, manufacturing/custody reconciliation, portable attachments/cutover, clean-machine signed release and factory procedure validation remain tracked in features.md. Mobile is deferred.

References checked: [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc), [server-verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser), and the changelog index including the previously reviewed [TLS change](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). Local HTTP acceptance does not prove hosted TLS compatibility.
