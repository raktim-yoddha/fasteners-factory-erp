# Desktop and backend acceptance — 2026-10-13

Environment: Windows 11 x64. Active priority: Electron desktop and Supabase team authority. Mobile is excluded by the owner.

## Executed checks

| Command                                    | Result                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                               | Passed: strict typecheck, ESLint and engineering contracts, 26 tests across 6 files, production web build     |
| `pnpm test:db`                             | Passed: 58 assertions against the isolated local PostgreSQL authority                                         |
| `pnpm test:api`                            | Passed: 8 real local Auth/HTTP checks; temporary fictional identities removed                                 |
| `pnpm e2e:web`                             | Passed: one Chromium flow for public landing separation, persistent worker SQLite and second-writer exclusion |
| `pnpm --filter @fasteners/desktop package` | Passed: Windows x64 NSIS installer                                                                            |
| `pnpm e2e:desktop:packaged`                | Passed: one flow against the actual bundled executable, 15.2 seconds                                          |
| `pnpm release:checksums`                   | Recorded installer and blockmap SHA-256                                                                       |
| Authenticode inspection                    | `NotSigned`                                                                                                   |

The packaged test exercises utility-process SQLite, renderer isolation, forged sender rejection, encrypted snapshot export and decryption, process exit, retained original request recovery, and a single commit after retry. It supplies a deterministic native save-dialog destination and uses a validated temporary SAMPLE workspace. The atomic export filesystem test separately proves preservation of an existing backup after partial write and replacement failures.

Backend checks were run earlier in this continuation against migrations through `20261013125328_receipt_reference_audit.sql`. The final renderer/main changes do not change that schema. SQL fixture changes roll back; the HTTP suite does not create tenant records or reset remote data.

## Artifact identity

Installer: `apps/desktop/release/Fasteners Factory ERP Setup 0.1.0.exe`, 124,937,336 bytes.

```text
db27f29c765c30ff7682880078112d18a5d554f25bf23a2292e519b31b53c510  Fasteners Factory ERP Setup 0.1.0.exe
d300c4d860679788e7eaae1a35e5eeca2824e82c939709bc560e97dcfc91cf74  Fasteners Factory ERP Setup 0.1.0.exe.blockmap
```

These identify this local development build. Subsequent rebuilds produce new checksums. No signing, public publishing, hosted CI execution or clean-machine installation is claimed.

## Limits

This evidence covers the implemented commercial/stock/dispatch slice and its authority boundaries. It does not complete M0–M10. Remaining workflow and runtime gates are authoritative in [features.md](../../features.md) and [testing.md](../testing.md). Portable restore/cutover, full manufacturing reconciliation, concurrent PostgreSQL contention, complete signed multi-role UI/device acceptance and production operations remain pending. Android remains owner-deferred.
