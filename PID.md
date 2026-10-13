# Project Initiation Document

Prepared: 2026-10-13. Product: Fasteners Factory ERP. Sponsor and acceptance authority: the product owner. Intended users: factory owners, managers, commercial staff, engineers, planners, buyers, stores, operators, inspectors, reviewers, subcontract coordinators and dispatch teams.

## Objectives and success

Provide an auditable operational thread from enquiry to shipment. Users must distinguish physical stock, reservations, holds, WIP and vendor custody; pin approved engineering; enforce actual review and movement gates; and recover local data without inventing a successful save.

The target has independent local SQLite workspaces and shared Supabase companies. Their authority is explicit in every command, route and cache. The owner confirmed no automatic synchronization. Internet connectivity alone cannot migrate local history or turn a solo workspace into a company.

## Priority and scope control

The owner's subsequent steering takes precedence over the baseline: (1) Electron Windows desktop, (2) the shared multi-person/multi-role backend, (3) mobile later. Mobile draft source is preserved but excluded from pnpm workspaces, lint, builds and completion gates. The browser client remains shared presentation and a supporting verification/landing surface.

The baseline remains `docs/handoff.md`, prepared 2026-10-13, SHA-256 `339e0548b9481ddf8b900220129173a408b92d881cbf9ffcbe874257e7cddaab`. Manufacturing behavior is a configurable proposal requiring factory validation. Changes to authority, stored formats, permissions and release behavior require ADRs and owning documentation updates.

## Milestones and acceptance gates

| Milestone | Outcome                                                                              | Required gate                                                                                                   |
| --------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| M0        | Contracts, exact compatible dependencies, monorepo, active shells, documentation     | Launch Electron/web; typecheck, lint, boundaries and contract equality                                          |
| M1        | Auth, companies/plants, invitation-bound membership, scoped roles and administration | Actual tenant, delegation, owner, revocation and independent-review tests                                       |
| M2        | Real SQLite, workspace lifecycle, exact values, idempotency and recovery baseline    | Restart, rollback, writer exclusion and honest storage failure                                                  |
| M3        | Masters, engineering and private versioned files                                     | Immutable revisions, tenant-aware files, BOM/routing/feasibility validation                                     |
| M4        | Commercial-to-dispatch flow from held finished stock                                 | Approved quotation/engineering, order acceptance, inspection/release, reserve, scan, dispatch and failure paths |
| M5        | Procurement and inventory breadth                                                    | Allocation, receipt/return, transfer/count and concurrency reconciliation                                       |
| M6        | Planning, production and equipment                                                   | Actual consumption/output, readiness, capacity and safe closure                                                 |
| M7        | Full quality, vendor work and genealogy                                              | Independent review, bounded physical dispositions, split/merge/assembly and custody conservation                |
| M8        | Reports, search, scans, printing, returns, exports and notifications                 | Scoped pagination, separately authorized exports and device evidence                                            |
| M9        | Portable full recovery and reviewed cutover                                          | Cross-runtime restore, attachment integrity and all-or-nothing cloud activation                                 |
| M10       | Release and pilot                                                                    | Installer/native artifact checks, clean machine, restore drill and production inputs                            |

Milestones are not complete because generic navigation or record types exist. Current evidence and remaining work are in `features.md` and `docs/testing.md`. Missing signing, devices or production inputs remain pending and cannot be substituted with SAMPLE tests.

## Dependencies, risks and exclusions

- Electron packages must contain a working pinned native SQLite module, bundled renderer and secure preload.
- Docker and the pinned Supabase CLI support local backend proof; hosted environments and real SMTP require deployment configuration.
- Domain rules run in both trusted TypeScript/SQLite and PostgreSQL. Shared vectors are necessary to control divergence.
- Local-only data can be lost through device loss, uninstall or browser clearing. Database-envelope proof is not yet complete attachment recovery or operational restore activation.
- Role combinations cannot bypass self-review restrictions. Operators must not receive unrelated prices or plant data.
- Live local databases are OS-protected, not claimed to be encrypted at rest. Backup encryption and credential protection are different features.
- No AI, double-entry ledger, statutory tax filing, direct banking/payroll, SaaS billing, customer/vendor portals, PLC control or unverified vision QC.

Production publication, paid resources, actual messages, signing and real factory rollout require owner-controlled operational authorization. Local reversible implementation and SAMPLE artifacts are authorized.
