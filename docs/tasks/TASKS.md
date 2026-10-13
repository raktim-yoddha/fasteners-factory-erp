# Delivery task board

Prepared: 2026-10-13. Status is a source-delivery assessment, not factory acceptance.

| Task                                           | Responsibility                                                | State                                   | Gate                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [0001](TASK-0001-monorepo-foundation.md)       | Tooling, core contracts, local services, web/desktop, backup  | In progress                             | Typecheck, lint, invariant suites, runtime persistence and packaging                                          |
| [0002](TASK-0002-cloud-authority.md)           | Supabase tenancy, Auth, RLS/RPC and cloud repository          | In progress                             | Real PostgreSQL isolation, authorization and transaction tests                                                |
| [0003](TASK-0003-native-mobile.md)             | Expo Android, native presentation and SQLite                  | Deferred by owner                       | Excluded from active workspaces/builds/checks; draft files preserved                                          |
| [0004](TASK-0004-documentation-validation.md)  | Canonical documentation, ADRs, CI and contract validator      | Implemented locally; hosted CI pending  | Agent equality, handoff checksum, boundaries and manifest pins                                                |
| [0005](TASK-0005-desktop-backend-integrity.md) | Desktop/native boundary and multi-role authority continuation | Implemented; evidence recorded          | Packaged runtime, exact revisions, durable confirmation, PostgreSQL/Auth gates and recorded unsigned artifact |
| [0006](TASK-0006-git-checkpoints.md)           | Independent project repository and local commit policy        | Implemented locally; push not requested | Correct Git root/origin, preserved parent, exact handoff bytes, identical contracts and clean committed work  |

M0–M10 scope and acceptance gates are defined in [PID](../../PID.md). Feature-level implementation and pending proof are tracked in [features](../../features.md). Unbuilt milestone features remain backlog even when their navigation entry or generic record kind exists.

Owner steering, 2026-10-13: work directly without subagents. Prioritize Electron desktop, then the multi-person/multi-role backend. Mobile is deferred. All remaining tasks are owned by the primary agent.
