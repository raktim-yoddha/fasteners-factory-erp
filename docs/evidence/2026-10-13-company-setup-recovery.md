# Company setup recovery acceptance — 2026-10-13

Environment: Windows 11 x64, Node 24.11-compatible tooling, pinned workspace dependencies. Mobile remains excluded. Results describe this slice, not completion of M1 or the full ERP.

## Delivered behavior

Desktop and browser composition roots supply a reusable account/backend-origin journal to the shared company setup controller and onboarding screen. Company fields and request key persist before dispatch. An exclusive Web Lock prevents competing windows replacing the request. Unknown confirmation survives restart and retries the original payload/key. Another account/backend cannot load it through its configured adapter. Corrupt/denied storage blocks new dispatch. No passwords, session tokens or invitation tokens are saved in the journal.

The cloud adapter captures a session token, verifies its user with Auth, checks the original verified account and pins that token to the company RPC. Success requires a valid UUID. Only recognized PostgreSQL rollback messages with HTTP 400 are treated as definitive initial rejection; unknown/proxy/malformed outcomes retain recovery evidence. A later denied retry cannot disprove an earlier uncertain commit. A committed company remains committed when local cleanup or list refresh fails.

The local Solo database remains SQLite in the Electron utility process. Team PostgreSQL is the database provided by Supabase. This continuation changes no schema/migration/generated database type and performs no automatic synchronization or hosted write.

## Executed gates

| Command                                    | Result                      | Meaning and limits                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                               | Passed                      | Typecheck, ESLint, engineering equality/checksum/pins/import checks, 63 tests across 9 files and production browser build                                                                                                                                                           |
| Company-focused shared tests               | 13 passed                   | Exact restart retry; account/backend isolation; definitive versus uncertain rejection; verified identity; storage/lock failure; concurrent writers; malformed success; cleanup failure; token binding and offline preflight                                                         |
| `pnpm test:db`                             | 73 assertions passed        | 58 actual local Supabase authority assertions, including company replay/changed-input rejection; 15 multi-session concurrency assertions in a guarded disposable migration-replayed database. Fixture business records are rolled back or removed with the owned temporary database |
| `pnpm test:api`                            | 10 checks passed            | Real local password JWT/current identity and access denials; actual verified-token company RPC rollback shape and no membership after invalid setup. Fictional Auth users removed; no company records created                                                                       |
| `pnpm e2e:web`                             | 3 flows passed              | Existing OPFS persistence/second writer plus two company setup fault flows: restart/original retry, account isolation, failed refresh, corrupt journal and actual browser Web Lock contention                                                                                       |
| `pnpm --filter @fasteners/desktop package` | Passed                      | Windows x64 native dependency rebuild and NSIS artifact                                                                                                                                                                                                                             |
| `pnpm e2e:desktop:packaged`                | 1 flow passed, 35.7 seconds | Bundled Electron/native SQLite, renderer isolation, real secure-origin writer lock, forged IPC denial, encrypted export, restore/restart, retained unknown confirmation and preservation checks                                                                                     |
| Local Supabase security advisors           | No issues                   | `supabase db advisors --local --type security --level warn --fail-on warn`                                                                                                                                                                                                          |

Company browser transport faults use a clearly fictional development-only entry under `apps/web/tests`, separate from production build entry points. Its simulated commit count is UI/controller evidence, not real PostgreSQL evidence. The packaged desktop test proves its writer-lock prerequisite and existing local regression flow; it does not claim a signed-in desktop Team/MFA workflow. Form appearance was inspected from the browser screenshot; this is not complete accessibility acceptance.

## Artifact identity

The locally generated installer is **NotSigned**. No clean-machine installer, production TLS, update/signing or store/public release gate is claimed.

```text
755b80ddc293a50c9588f0a02ee53b446d1868db2309f41cd1bef7dc4e40fcc4  Fasteners Factory ERP Setup 0.1.0.exe
5fdfdaffbac89d9dc69cea55add5e6cfbce4925dd212a4e4b4ef5f7fdfde62e8  Fasteners Factory ERP Setup 0.1.0.exe.blockmap
```

These files and `SHA256SUMS.txt` live under ignored `apps/desktop/release`; runtime artifacts and credentials are excluded from Git.

## Remaining gates

Invitation/access/plant/ownership administration transport recovery, signed-in multi-role desktop UI, MFA/deep-link/recovery-device proof, immutable private files and normalized engineering/production breadth remain pending. So do portable attachment recovery/cutover, clean-machine signed release and factory validation. Mobile is deferred by the owner. No Git push or hosted deployment was performed.

Official references checked: [Supabase database engine](https://supabase.com/docs/guides/database/overview), [RPC interface](https://supabase.com/docs/reference/javascript/rpc), [server-verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser), and [2026-10-12 TLS deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). Local HTTP acceptance does not prove hosted TLS compatibility.
