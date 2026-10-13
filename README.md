# Fasteners Factory ERP

A TypeScript monorepo for independent SQLite workspaces and shared Supabase company operations.

**Current priority:** Windows Electron desktop, then the multi-person and multi-role backend. Mobile is deferred by the owner and excluded from active workspaces and validation. The full manufacturing handoff is a delivery roadmap; the initial commercial/stock/dispatch slice is implemented, while the remaining milestone gates are tracked explicitly in [features.md](features.md).

## Run locally

Prerequisites: Node.js 24.11 or compatible supported Node 24, pnpm 11.5.3, Windows 11 x64 for Electron, and Docker Desktop for the isolated local backend.

```powershell
pnpm install --frozen-lockfile
pnpm dev:desktop
```

Solo mode does not require Supabase configuration or a network after installation. Create an empty workspace or explicitly load fictional SAMPLE data. SQLite is owned by the Electron database utility process. Browser presentation can be developed with `pnpm dev:web`.

For shared companies:

```powershell
pnpm db:start
pnpm db:types
pnpm test:db
pnpm test:api
```

The isolated backend uses API port **55321**, database **55322**, and mail capture **55324**. It does not reuse the neighboring project's database. Copy `.env.example` to `.env`, set only the local publishable project key and URL, and rebuild the desktop renderer. Never put a secret/service-role key in client configuration. Register and verify email through local mail capture, sign in, and create a company. Invitation creation returns a single-use token; delivery is explicit and not sent automatically.

## Commands

| Command                                    | Behavior                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `pnpm dev:desktop`                         | Builds bundled presentation/processes and starts Electron                   |
| `pnpm dev:web`                             | Starts the shared browser UI and public landing page                        |
| `pnpm check`                               | Typecheck, lint/contract checks, unit/local tests, web build                |
| `pnpm test:db`                             | Runs rollback-contained assertions against actual local PostgreSQL          |
| `pnpm test:api`                            | Verifies local signed Auth/HTTP boundaries and removes fictional identities |
| `pnpm e2e:desktop`                         | Exercises the real Electron bridge and restart persistence                  |
| `pnpm e2e:web`                             | Exercises browser OPFS persistence and writer exclusion                     |
| `pnpm build:desktop`                       | Builds renderer, main, preload and utility bundles                          |
| `pnpm --filter @fasteners/desktop package` | Builds the Windows NSIS installer                                           |
| `pnpm e2e:desktop:packaged`                | Exercises the bundled Windows executable with isolated SAMPLE data          |
| `pnpm release:checksums`                   | Writes SHA-256 sums for the unsigned Windows development artifacts          |
| `pnpm test:restore`                        | Tests encrypted database envelope integrity and rejection cases             |
| `pnpm db:types`                            | Regenerates database types from the running local schema                    |

Install the matching Playwright browser once with `pnpm exec playwright install chromium`. Mobile commands intentionally return a deferred-status error. `test:parity` currently proves shared exact-value/contract vectors; full PostgreSQL/browser/native business parity remains a broader acceptance gate.

Business commands retain one identity/authority-bound pending request before dispatch. Interrupted confirmation survives restart and retries the original key. Offline team writes are blocked; this journal is not an offline synchronization queue. Material consumption, production output, NCR closure, and CSV export remain disabled until their complete reconciliation or authorization slices are delivered.

## Repository and checkpoints

This folder is an independent Git repository on `main`, with `origin` pointing to [raktim-yoddha/fasteners-factory-erp](https://github.com/raktim-yoddha/fasteners-factory-erp). The enclosing checkout and sibling projects retain their own configuration.

Every completed change must pass its applicable checks and receive a focused local commit before the next change or the end of a work session. The authoritative rule is in [AGENTS.md](AGENTS.md) and its identical [CLAUDE.md](CLAUDE.md). Commits provide local rollback checkpoints; publishing to GitHub is a separate action. Secrets, databases, build outputs and installers remain excluded.

Inspect checkpoints with `git log --oneline`. Use `git revert <commit>` to undo a completed change while retaining history; inspect the selected change and preserve any current work before reverting.

## Documentation

- [PID.md](PID.md): project initiation, priority, delivery gates and risks.
- [PRD.md](PRD.md): product requirements and authority semantics.
- [architecture.md](architecture.md): runtime boundaries, data model and dependency direction.
- [design.md](design.md): presentation scope, reusable components and accessibility.
- [features.md](features.md): feature coverage, limitations and evidence status.
- [cloud.md](cloud.md): backend, access, configuration and operations.
- [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md): identical engineering contracts.
- [docs/handoff.md](docs/handoff.md): preserved owner-provided baseline.
- [docs/testing.md](docs/testing.md), [docs/security.md](docs/security.md), [docs/deployment.md](docs/deployment.md), and [docs/tasks/TASKS.md](docs/tasks/TASKS.md).

Fictional fixtures, limits, methods and tolerances are design proposals, not verified factory SOP. This product does not claim full accounting, GST filing, Tally compatibility or factory certification. Signed/public release and production deployment are separate operational steps.
