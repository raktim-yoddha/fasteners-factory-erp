# Fasteners Factory ERP — complete build handoff

Prepared: 2026-10-13. Deliverable: one self-contained specification for a fresh repository.

## 1. Instruction to the receiving agent

You are the architect and implementation agent for **Fasteners Factory ERP**, a deterministic manufacturing operations application for fastener and precision-component factories. Build the product described in this file from scratch, incrementally, with working persistence, authorization and tests. Deliver an Electron Windows desktop application, a React Native Android application, and a React browser web application, backed by Supabase for shared company workspaces and SQLite for independent solo workspaces.

This is an operations product, not a landing page, mockup, collection of disconnected screens, or AI assistant. A completed action means the active database authority committed it. Implement the entire agreed scope through the milestones below; do not call an attractive shell a completed ERP.

**Document authority:** the owner explicitly requested Electron, React Native, web, Supabase, role-based access and company creation. The manufacturing behavior below is a **DESIGN PROPOSAL**, adapted from an existing manufacturing ERP brief. It is not verified factory SOP. Label fictional fixtures `SAMPLE`. The authority split preserves the prior owner decision: independent device-local solo workspaces, shared cloud team workspaces, optional encrypted backup, and reviewed masters/opening-balance cutover without automatic bidirectional sync.

This file is sufficient as a handoff; do not require access to the original repository or its documents. The existing repository is not authorization to overwrite an existing application, reset databases or deploy production. If asked to implement in an existing checkout, inspect its contract and preserve existing work before reconciling this owner-authorized target architecture.

### Working defaults for the fresh build

- Windows 11 x64 desktop, Android phones/tablets, and current Chrome/Edge browsers are first-release targets. Do not advertise macOS, Linux or iOS support until independently packaged and tested.
- English first. Plant timezone defaults to `Asia/Kolkata`; currency defaults to INR. Both are explicitly configured per company. These defaults do not imply tax compliance.
- Solo mode exists on all three clients. Each device/browser profile owns a separate workspace. No live shared database exists between those solo workspaces.
- Team mode exists on all three clients and uses the same Supabase backend and permission model.
- Use email/password registration, verified email, sign-in, password recovery and invitation acceptance for the fresh cloud product. This is a proposed successor onboarding flow, not the historical application's approved-account-only sign-in implementation.
- A verified account may create multiple companies and belong to multiple companies. A company may contain multiple plants and warehouses. There is no marketplace, SaaS billing or global customer-data administrator in the first release.
- No AI features, model providers, gateways or AI-dependent workflows. No automatic purchasing, tax filing, banking, payroll, customer/vendor portals, PLC control or unverified vision-based QC.
- All role-based collaboration and independent reviews are cloud-only. Solo is single-owner operation; see section 5 for its explicit review semantics.
- No real people, factory records, credentials, contact details or customer documents in fixtures or prompts. Use neutral fictional data such as `SAMPLE Factory A`, `SAMPLE Customer A`, `SAMPLE Supplier A` and `sample-user@example.invalid`.

## 2. Product outcomes and complete scope

The product follows orders from enquiry to shipment, with configurable engineering, purchasing, stores, production, quality, subcontracting and dispatch. Managers must be able to answer these questions from actual records:

1. What did the customer request, and which drawing, quotation and accepted order revisions govern it?
2. What must be made, bought, subcontracted or supplied from finished stock?
3. What stock is present, reserved, on QC hold, in WIP or held by vendors?
4. Which materials, operations, inspections and packages produced and carried each lot?
5. What blocks the job, who can resolve it, and what commitment is at risk?
6. What has actually shipped, returned or been reversed?

Deliver administration/company onboarding, customer and supplier masters, exact units and item specifications, immutable drawings/BOMs/routings, commercial workflows, procurement, append-only stock, work orders/job cards, quality/NCR, vendor custody, assembly, packing/shipment, equipment readiness/capacity, private documents, reports, search/scanning, controlled imports/exports, backup/restore, notifications, audit and operational delivery tooling.

**Accounting boundary:** include cost sheets, quotation pricing, configurable tax lines on commercial calculations, invoice/payment references, outstanding commercial summaries and approved accounting exports. A complete double-entry general ledger, statutory GST filing, tax invoices certified for real use, banking and direct Tally integration are separate future projects. Do not imply those exist because this ERP has prices or CSV exports.

## 3. Technology stack

Select mutually compatible stable versions at implementation time, verify official documentation, pin exact dependency versions and commit one pnpm lockfile. Do not copy an old version number from an example or use a development branch to obtain an optional feature.

| Area | Required technology and responsibility |
|---|---|
| Language/tooling | TypeScript strict mode; pnpm workspaces; ESLint; formatter; one committed lockfile |
| Web | React + Vite + React Router; Tailwind CSS + shadcn/ui; `vite-plugin-pwa`/Workbox for controlled installation/offline shell |
| Desktop | Electron; bundled local React/Vite renderer reusing the web presentation; a narrow preload bridge and isolated database utility process |
| Desktop SQLite | Native SQLite using `better-sqlite3` in the database process; rebuild the native module for the pinned Electron ABI and prove it in the installed artifact |
| Desktop packaging | `electron-builder` and its compatible updater; Windows installer and signed update metadata/artifacts; signing credentials are externally supplied secrets |
| Mobile | React Native + Expo, TypeScript, Expo Router and native development/release builds; React Native primitives rather than DOM components |
| Mobile storage | `expo-sqlite` for native SQLite; Expo FileSystem for managed attachments; Expo SecureStore for small sensitive secrets |
| Mobile capabilities | Expo Camera for permission-controlled barcode/QR scanning; native sharing/document selection/printing through verified compatible Expo modules |
| Web SQLite | Official `@sqlite.org/sqlite-wasm` in a dedicated worker with OPFS persistence; explicit single-writer locking; no in-memory fallback that claims to save |
| Cloud | Supabase PostgreSQL, Auth, RLS, private Storage, SQL migrations and narrow Edge Functions |
| Cloud client | Official `@supabase/supabase-js`; publishable project key plus authenticated user session; never direct client Postgres credentials |
| Query state | TanStack Query for remote/read-model state; keys include authority, user/company or local workspace, plant and entity identity |
| UI state | Component state by default; Zustand only for truly global ephemeral UI state |
| Boundary validation | Zod and shared typed contracts; SQL constraints as final enforcement |
| Exact calculations | Shared TypeScript decimal-text/scaled-integer utilities; PostgreSQL NUMERIC; never binary floats for domain truth |
| Tests | Vitest; React Testing Library; React Native Testing Library; Playwright including Electron automation; real PostgreSQL and SQLite suites; Maestro or an equivalent verified native Android runner |
| Hosting | Static web build on Cloudflare Pages; Supabase hosted team backend; authenticated desktop release storage; Android APK/AAB artifacts |

Do not add Next.js, Tauri, another application backend, an ORM to hide important transaction semantics, a distributed-sync framework or a universal component library merely to satisfy all platforms. Supabase Edge Functions are trusted integration boundaries, not a second copy of every database command.

**Share contracts, domain utilities, read-model shapes, feature controllers and behavior tests. Share DOM presentation between web and Electron. Implement mobile presentation with native components.** Do not import Electron, Node filesystem APIs, browser globals or React Native APIs into platform-neutral packages.

## 4. Repository structure and dependency direction

Create a focused monorepo with this responsibility structure. Names are the target organization; do not generate empty modules just to fill the tree.

```text
fasteners-factory-erp/
  AGENTS.md                       # sole engineering contract
  CLAUDE.md                       # identical contents; automated equality check
  README.md
  CHANGELOG.md
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  .env.example                    # neutral placeholders; public configuration only
  apps/
    web/
      src/{app,routes,platform}/
      public/
      vite.config.ts
    desktop/
      src/main/{windows,auth,ipc,files,printing,updates}/
      src/preload/
      src/database/{entry,connection,commands,queries,backup}/
      src/renderer/               # compose shared DOM presentation
      electron-builder.yml
    mobile/
      app/                        # Expo Router routes
      src/{platform,components,screens}/
      app.config.ts
  packages/
    contracts/                    # schemas, DTOs, command IDs, typed errors
    domain/                       # pure exact math, units, transitions, planning rules
    application/                  # controllers, repository ports, capability model
    ui-web/                       # shared web/desktop screens and primitives
    ui-native/                    # native primitives and mobile screen patterns
    design-tokens/                # semantic colors, spacing, typography, target sizes
    cloud-repository/             # scoped reads, RPC client, cloud Auth adapters
    local-domain/                 # solo services and read models, DB port only
    sqlite-schema/                # versioned schema and dialect-specific migrations
    sqlite-desktop/               # private native driver adapter
    sqlite-mobile/                # private Expo SQLite driver adapter
    sqlite-web/                   # private WASM/OPFS driver and worker adapter
    backup/                       # snapshot/envelope contract, validation, crypto port
    test-fixtures/                # deterministic SAMPLE data and acceptance vectors
  supabase/
    config.toml
    migrations/                   # CLI-created immutable migration identities
    functions/{staff-invites,solo-backups,cutover-files}/
    tests/                        # tenant, permission and transaction SQL regression
    seed.sql                      # SAMPLE only; never reset a remote DB to seed
  tests/{acceptance,web,desktop,mobile,security,backup,parity}/
  scripts/{validation,release,operations}/
  docs/
    product.md
    architecture.md
    domain-model.md
    workflows.md
    security.md
    style.md
    testing.md
    deployment.md
    open-questions.md
    tasks/{README.md,TASKS.md,TASK-NNNN-slug.md}
  adr/{TEMPLATE.md,NNNN-short-kebab-name.md}
  .github/workflows/{ci.yml,release.yml,restore-proof.yml}
```

Dependency direction: presentation calls application ports; adapters implement those ports; local services call a private database port; the shared domain package has no UI, filesystem, network, Auth SDK or driver imports. Supabase implements team invariants in trusted SQL, supported by shared test vectors. A TypeScript UI validator is never a substitute for server enforcement.

Use lint/import checks to prevent privileged modules from entering web/mobile UI bundles. Generate Supabase database types into a dedicated package/file through a reproducible command; do not hand-edit generated types. Keep business DTOs separate from database row types.

## 5. Authority, offline behavior and workspace lifecycle

| Mode/client | Source of truth | Successful write | Offline behavior |
|---|---|---|---|
| Electron solo | Native SQLite + app-managed local documents | Confirmed local transaction | Full applicable single-owner commands after installation, including first launch |
| React Native solo | Native SQLite + app-managed local documents | Confirmed local transaction | Full applicable single-owner commands after installation |
| Browser solo | SQLite WASM/OPFS + origin-managed local documents | Confirmed worker transaction | Applicable commands after initial assets are cached; browser persistence must pass a real capability check |
| Any team client | Supabase PostgreSQL/private Storage | Server-confirmed RPC transaction | Shell, explicit local drafts and selected identity-bound cached reads; no queued critical writes |

### Solo rules

- A solo workspace needs no Supabase configuration, account or network to create and use. Support multiple separate local workspaces with clear names and an active-workspace selector.
- Every local workspace has an immutable UUID and device provenance, distinct from a cloud company ID. Use an explicit authority discriminator in routes, repositories, caches and command contracts.
- A local owner can perform applicable factory operations but cannot create independently authenticated staff, grant cloud roles or impersonate cloud inspection approval.
- Record solo review/release actions as `owner_attestation` with local provenance. A workflow configured to require an independent second reviewer is unavailable in solo; explain that team mode is required. Solo defaults use owner attestation for those review points.
- Never read/write a single SQLite file over a network share for simultaneous users. Never use SQLite as an offline mirror of team stock.
- A desktop process or web tab holds the workspace writer lock. A second writer receives a useful read-only/busy screen. Serialize mobile commands and prevent transaction interleaving. Do not hold a DB transaction across file pickers, network requests or UI prompts.
- Mobile termination, app uninstall, browser data clearing, low disk space and device loss are real lifecycle cases. Display storage/backup health and provide tested restore; do not promise that local-only data survives uninstall.

### Team rules

- Connectivity means an authenticated request can reach the authority, not merely that the OS reports a network. On an uncertain response, show `Confirmation unknown`, preserve the original idempotency key and query/retry that request.
- Critical team commands never silently fall back to local SQLite. Offline drafts are explicitly unsent, cannot reserve stock or issue approvals, and require revalidation before submission.
- Do not persist a complete team database in SQLite. The web service worker caches static assets only. Selected team offline read snapshots are explicit, limited, permission-filtered and stored separately from solo data; purge them on logout, membership change or identity switch.
- An already cached offline screen cannot prove current authorization. Label its age and lock privileged local access when the session expires. Remotely revoked access cannot instantly erase an offline device; minimize cached data accordingly.
- Use workspace/user changes to cancel in-flight work, detach Realtime channels, discard old results and clear identity-scoped state.
- Cloud logout clears credentials and team caches without deleting independent solo workspaces or their backups.

### Moving from solo to team

Provide a guided, explicit cutover: export a recoverable source snapshot; preview master mappings and opening balances; list unresolved orders, WIP, vendor custody, reservations and NCRs; require reconciliation before acceptance; validate staged files/records server-side; import atomically with idempotency; hold opening stock for new cloud QC; retain readable solo history and provenance. Freeze solo writes only after confirmed cloud import. Interrupted/rejected cutover leaves the source intact. A company switch is never an upload, import or merge.

Transferring a solo workspace between devices uses a verified portable snapshot and an explicit ownership move; it is not two-device live collaboration.

## 6. Authentication, registration and company creation

Implement real Supabase Auth on all clients. Include registration, verified-email state, login, recovery, logout, expired-session recovery, invitation acceptance and company selection. Use local mail capture and fictional addresses for automated development tests; real delivery is a deployment action requiring owner authorization.

### Company creation flow

1. A person can immediately choose `Solo on this device`, or sign in/register for `Team online`.
2. A verified cloud account with no memberships sees `Create company` and `Accept invitation`, not an empty operational dashboard.
3. Company setup collects company display name, optional legal/reference fields, plant name, country, explicit currency/timezone, initial warehouse and numbering preferences. Tax registration fields are optional configured data, never fabricated.
4. One idempotent trusted `create_company` command creates the company, initial plant/warehouse, fixed built-in role templates, creator's active Owner membership and audit event in one transaction. Derive actor from Auth, never a supplied owner ID or role name. Rate-limit creation; a timeout must not create duplicate companies.
5. The setup checklist covers masters, approved engineering, opening stock on QC hold, invitation/role setup and backup readiness. A new company contains no invented operating stock or customers. SAMPLE data is opt-in and visibly identified.
6. The company switcher lists only active memberships. A user can be Owner in one company and Operator in another without permission leakage.

### Company administration

Support company profile/settings, plant/warehouse administration, explicit document numbering, membership list, role assignments, invitations, revocation, owner transfer, audit search and company archive. Protect the last active Owner. Ownership transfer requires the receiving active verified member and a recorded acceptance. Admin cannot remove/demote an Owner or grant Owner implicitly. Only Owner can transfer ownership or archive a company; archive blocks new business commands while preserving readable authorized history.

Do not implement a destructive company-delete button in the first release. Settings that alter currency, base units or inventory valuation cannot rewrite existing events; introduce effective dates/new versions and preview impact.

### Invitations and session handling

- Invite authorization comes from current company membership. Store a hashed invitation token, normalized intended email, expiration, inviter, company, proposed roles and plant scope. Acceptance is bound to verified matching Auth identity, single-use and atomic. Invited role assignments cannot exceed the inviter's delegation rights.
- Invitation acceptance also rechecks that the company is active and the inviter still has authority to grant those current roles/scopes; a stale invitation cannot restore revoked privileges.
- A narrow authenticated Edge Function may use server-only Auth administration privileges for invitations. Validate the user and their current rights before elevation; never trust a client-supplied company/role/user combination. Retries do not duplicate delivery or membership.
- Privileged actions consult protected current membership data, so role removal takes effect without waiting for a stale role claim to refresh. Cloud authorization never uses editable `user_metadata`.
- Desktop stores refresh credentials using the supported Electron OS-backed secure storage API, accessed from its privileged process. Mobile uses a tested SecureStore adapter; account for small-value limits and chunking where required. Do not store database files in SecureStore. Web follows the official browser Auth flow with a restrictive CSP and verified redirects.
- Validate OAuth/recovery/deep-link callbacks through allowlisted origins and PKCE/state where applicable. Configure Android app links and desktop callback handling; reject unexpected URLs. Do not log tokens.
- Provide MFA enrollment/recovery for Owner/Admin and allow company enforcement for privileged team operations. Document and test actual server enforcement; a hidden MFA prompt is insufficient.

## 7. Role-based access control

Model permissions as **action + company + plant scope**, with optional assignment/resource restrictions. Roles are protected permission bundles; users can hold several roles. A UI capability map improves UX, while trusted commands and RLS enforce the same rules.

| Role template | Intended capabilities | Explicit separation |
|---|---|---|
| Owner | Company ownership, settings, delegable access administration, business permissions | Cannot bypass stock/QC invariants or impersonate an independent reviewer |
| Administrator | Company setup, approved membership/role administration, configuration | Cannot grant/transfer Owner or obtain all business approvals merely by being Admin |
| Management | Cross-functional reports, assigned commercial approvals/escalations | No direct ledger edits; approval rights are explicit |
| Sales | Customers, RFQs, quotations, PO matching, sales orders | No engineering release, QC release or stock adjustment |
| Engineering | Item specifications, drawings, BOM/routing drafts, feasibility | Engineering approval is an explicit separately grantable permission |
| Costing/Commercial | Cost sheets, price/terms revisions, commercial review | Threshold overrides require assigned approval permission |
| Planning | MRP, demand, work orders, schedule/capacity | No receipt/QC bypass or invented stock |
| Purchasing | Suppliers, requisitions, purchase orders, expected receipts | PO approval separated from preparation where policy requires |
| Stores | Receipt, pick/reserve, issue/return, transfers, count preparation | No independent count review or QC release by default |
| Production supervisor | Job assignment/start/stop, operational output, equipment readiness | No engineering/QC approval by default |
| Operator | Read assigned jobs; record permitted progress/output/downtime | No unrelated plant data, prices, staff access or broad stock actions |
| Quality inspector | Read approved plans and record measurements/inspection evidence | Does not release own inspection when independent review is required |
| Quality reviewer | Holds, inspection review, lot release and NCR disposition | Independent review checks actor identity and current evidence |
| Subcontract coordinator | Vendor outward/return/loss reconciliation | No vendor-stock deletion or QC bypass |
| Packing/Dispatch | Packages, scans, shipment preparation/confirmation | Must pass current stock/QC gates |
| Accounts | Approved commercial/accounting exports and invoice/payment references | No general ledger/tax-filing claim; no access management |
| Auditor | Scoped read-only records, traceability and audit | No business mutations or privileged file access without explicit permission |

Initial permission keys include `company.manage`, `plants.manage`, `members.invite`, `members.manage`, `roles.assign`, `company.transfer_owner`, `company.archive`, `master_data.read`, `master_data.manage`, `engineering.approve`, `sales.read`, `sales.manage`, `commercial.approve`, `planning.manage`, `procurement.manage`, `procurement.approve`, `stock.read`, `stock.receive`, `stock.reserve`, `stock.issue`, `stock.transfer`, `stock.count`, `stock.review_count`, `production.read`, `production.execute`, `production.assign`, `quality.read`, `quality.inspect`, `quality.review`, `jobwork.manage`, `dispatch.manage`, `dispatch.confirm`, `equipment.manage`, `documents.read`, `documents.manage`, `reports.read`, `accounting.export`, `audit.read` and `data_transfer.manage`.

Specify and seed role-to-permission mappings in migrations, with tests; do not scatter role-name conditionals across screens. Role edits/delegation require scoped protected commands and audit. Do not automatically union privileged approvals just because one member has multiple roles: policies can still prohibit self-review.

## 8. Supabase tenant security and backend organization

Use one Supabase project per environment, not one project per company. Separate development, staging and production. Company tenancy is represented in protected data, RLS, commands and private Storage.

- Every tenant-owned row has a non-null `company_id`. Plant-owned rows additionally have `plant_id`. Enforce composite relationships so a line from Company A cannot reference Company B's order, lot, plant or file.
- Protect `companies`, `plants`, `memberships`, `roles`, `permissions`, `role_permissions`, `member_role_assignments`, `member_plant_scopes`, `invitations`, approval policies and settings from arbitrary client writes. Separate personal profile editing from membership authority.
- Enable RLS on every exposed table. Policies require active membership, relevant permission and plant/resource scope; `TO authenticated` alone is not tenant authorization. Index policy predicates. Ordinary users cannot discover non-member company names or enumerate Auth accounts.
- Prefer scoped read APIs/views with `security_invoker = true`. Do not create a reporting view that bypasses tenant filtering. Search, counts, aggregates, downloads, CSV exports and Realtime have the same permission boundary as detail screens.
- Revoke direct client mutations for business transition/ledger/audit tables. Expose narrow typed RPCs. Prefer SECURITY INVOKER; where elevated writes are necessary, put checked helpers in a non-exposed schema, fully qualify names, fix search_path, revoke default PUBLIC/anon execution and grant only intentional access. A helper must recheck authenticated identity and current authorization itself.
- Stock/business multi-table transitions execute inside one Postgres transaction. An Edge Function calling several independent REST writes is not atomic; use a single RPC for the invariant-owning part.
- Edge Functions independently verify identity, permission, payload, rate limits and replay/idempotency. A publishable key identifies the application; it is not a user's authentication or authorization.
- Supabase publishable key and project URL may be shipped in clients. Secret/service-role keys, database passwords, SMTP credentials, signing keys and encryption recovery keys may never enter browser/mobile/desktop bundles, client env prefixes or public repositories. Electron is a distributed client, not a safe place for cloud admin credentials.
- Private company files use tenant-aware object metadata and company membership policies. Solo cloud backups use a different private bucket with account ownership, not company membership. Short-lived signed URLs may outlive a membership change until expiration; choose bounded lifetimes and do not persist them as permanent links.
- Use immutable file versions; upload to staging, validate size/type/hash and finalize the version through a trusted command. Unreferenced staging files are cleaned by a bounded retention job. Never assume database rows and Storage uploads form one distributed transaction.
- Realtime is optional targeted invalidation after authorization, not authoritative confirmation. Query fresh state after reconnect. Do not broadcast full sensitive rows publicly.
- No unneeded Cron/Queues deployment. Add an idempotent outbox only for an implemented asynchronous job such as internal notifications or staging cleanup; it cannot split a critical business transaction.

## 9. Domain integrity and shared command contract

### Exact values, dates and versions

- Transport all quantities, money and measurements as canonical decimal strings with explicit unit/currency. Validate scale, bounds and rounding rules. Use scaled integer/BigInt arithmetic in local TypeScript; serialize values as strings, not BigInt or JS numbers. IDs and large ledger sequences must survive JSON without rounding.
- Store team values as PostgreSQL NUMERIC; local values as validated decimal TEXT with exact arithmetic. Use constraints/triggers and trusted commands to reject unsupported local representations. Do not store domain values as SQLite REAL.
- Store timestamps in UTC, display plant timezone, and distinguish a date-only due date from an instant. Configure integer document sequences transactionally per company/plant/document type and period; never generate authoritative numbers from a client clock.
- Approved drawings, item specifications, unit conversions, BOMs, routings and inspection plans are immutable versions. Quotes, orders, jobs and inspections pin IDs. Correct through replacement versions/events, not historical overwrite.
- Every object has its own explicit state machine. The 16 navigation stages are not one giant status column.

### Stock and transactional rules

Stock is an append-only signed ledger. On-hand, reserved, QC hold, WIP, vendor custody and available-to-promise are independently derived projections of recorded facts. Use positive receipts and negative issues with origin/reference, lot/location/custody, exact quantity/unit and reversal linkage. Never maintain a separate freely editable quantity field as truth.

Reservation consumes availability, not physical stock. Issue moves physical custody; later consumption must not subtract stores stock again. Transfers use paired events in one command. Counts post reviewed difference events rather than replacing balances. Vendor return/output/customer-return receipts create held lots. Negative physical stock or availability is rejected. QC holds must block subsequent issue/packing/dispatch even when reservations or packages already exist.

For each command, validate identity/authority, tenant relationships, permissions, transition, pinned revision, exact quantity/unit, available balances, required inspection/equipment evidence and idempotency; then mutate domain rows, ledger, genealogy and audit atomically. Lock relevant rows in a consistent order in PostgreSQL. In SQLite, serialize writes and run one real transaction with constraints enabled. Reject stale versions with no partial changes.

```ts
type Authority =
  | { kind: 'solo'; workspaceId: string }
  | { kind: 'team'; companyId: string; plantId?: string };

type CommandRequest<T> = {
  contractVersion: 1;
  command: string;             // implemented commands form a closed validated union
  authority: Authority;
  idempotencyKey: string;
  expectedRevision?: string;
  payload: T;
};

type CommandResult<T> =
  | { ok: true; value: T; committedAt: string; authority: Authority }
  | { ok: false; error: { code: string; message: string; retryable: boolean; correlationId: string } };
```

Server/process identity determines the actor; clients do not supply trusted actor/approval identity. Scope idempotency to authority, actor and command; save a canonical payload fingerprint and result. Same key/same payload returns the committed result; same key/different payload returns `IDEMPOTENCY_KEY_REUSED`. Keep the key on uncertain transport failures. Perform result lookup under current authorization, so revoked members cannot retrieve prior data through idempotency history.

Required errors include `AUTH_REQUIRED`, `PERMISSION_DENIED`, `COMPANY_SCOPE_MISMATCH`, `INVALID_INPUT`, `INVALID_TRANSITION`, `REVISION_CONFLICT`, `IDEMPOTENCY_KEY_REUSED`, `INSUFFICIENT_AVAILABLE_STOCK`, `LOT_QC_HOLD`, `UNIT_MISMATCH`, `INSPECTION_REQUIRED`, `INDEPENDENT_REVIEW_REQUIRED`, `EQUIPMENT_NOT_READY`, `OFFLINE_TEAM_WRITE_BLOCKED`, `WORKSPACE_BUSY`, `STORAGE_UNAVAILABLE`, `BACKUP_INVALID` and `SCHEMA_INCOMPATIBLE`. Public errors must not leak inaccessible company records or raw SQL/secrets.

Examples of actual command families to implement are `create_company`, `invite_member`, `accept_invitation`, `assign_member_roles`, `approve_engineering`, `accept_sales_order`, `approve_purchase_order`, `receive_goods`, `reserve_stock`, `issue_material`, `return_material`, `consume_material`, `start_job`, `record_job_progress`, `record_production_output`, `record_inspection`, `open_ncr`, `authorize_ncr_disposition`, `release_lot`, `send_jobwork`, `receive_jobwork`, `split_lot`, `merge_lots`, `review_stock_count`, `verify_packing`, `confirm_dispatch` and `receive_customer_return`. Command names alone are not implementations; each requires its invariant tests.

Audit/ledger corrections are reversal or superseding events. Preserve actor, provenance, timestamp, reason, revision pins and causal/correlation references. Local audit is useful event history, not cryptographically tamper-proof proof against a device administrator.

## 10. Logical data model

Create normalized relational schemas and an ERD before the dependent slice. The names below identify responsibility; consolidate overlapping concepts rather than creating duplicate stock or approval models. Add tables only when implementing their feature.

| Domain | Main records |
|---|---|
| Identity/company | companies, plants, profiles, memberships, roles, permissions, role_permissions, member_role_assignments, member_plant_scopes, invitations, approval_policies, company_settings, document_sequences |
| Parties | customers, customer_contacts, suppliers, supplier_contacts, addresses, commercial_terms, customer_item_references |
| Items/units | items, item_categories, uoms, item_specification_versions, unit_conversion_versions, conversion_events |
| Engineering | drawings, drawing_versions, bom_versions, bom_lines, routing_versions, routing_operations, engineering_packages, feasibility_reviews |
| Commercial | rfqs, rfq_lines, interaction_events, cost_sheets, cost_lines, quotations, quotation_lines, customer_po_versions, po_matching_issues, sales_orders, sales_order_lines, delivery_schedules |
| Procurement | purchase_requisitions, requisition_lines, purchase_orders, purchase_order_lines, requisition_allocations, goods_receipts, receipt_lines, supplier_returns |
| Inventory | warehouses, locations, stock_lots, stock_ledger_entries, stock_reservations, stock_counts, count_lines, stock_count_reviews, lot_genealogy, custody_events |
| Production | work_orders, work_order_requirements, job_cards, job_events, operator_assignments, material_issues, material_events, production_outputs, downtime_events |
| Quality | inspection_plan_versions, inspection_characteristics, inspections, measurement_records, ncrs, disposition_events, lot_release_events |
| Job work/assembly | subcontract_orders, vendor_outward_events, vendor_return_events, vendor_loss_events; assembly modeled through pinned engineering/work orders |
| Dispatch | packing_orders, packages, package_contents, shipments, shipment_packages, shipment_events, customer_returns, return_lines |
| Equipment/capacity | work_centres, machines, tools, gauges, calibration_events, maintenance_events, readiness_events, shifts, capacity_allocations |
| Files | documents, document_versions, upload_staging, document_links; authority-scoped immutable blob references |
| Administration/operations | audit_log, idempotency_records, internal_notifications, import_batches, import_previews, export_snapshots, backup_metadata, cutover_batches; outbox only where needed |

Solo SQLite uses equivalent business concepts but local workspace identity and owner provenance. It does not reproduce Supabase Auth users, cloud memberships or independent approval credentials. Keep platform migrations separate where SQLite capabilities differ; do not execute PostgreSQL SQL files against SQLite. Persist schema versions and migration checksums. Use foreign keys, unique/check constraints and append-only enforcement. Select explicit archive/inactive behavior for referenced masters; cascading deletion must never erase business history.

Company and plant foreign keys must be validated at commit, not only dropdown selection. Distinguish item identity from approved item specification, customer part reference from internal item, physical lot from reservation, job output from finished-goods release, and shipment preparation from actual dispatch.

## 11. Navigation backbone: all 16 stages

The app can skip irrelevant stages, repeat operations or run streams in parallel. A finished-stock order need not manufacture new stock. Each stage shows its own objects and gates; the Order Command Center aggregates them.

| Stage | Required feature and controlling artifact |
|---|---|
| 01 Sales/enquiry | RFQ, customer requirement snapshot, contacts, attachments, owner and next action |
| 02 Technical/feasibility | Drawing/item revision review, make/buy/job-work decision and approved engineering pins |
| 03 Costing/quotation | Exact cost sheet, quote revisions, terms, approval thresholds and approved printable output |
| 04 Order acceptance | Customer PO reconciliation, discrepancy resolution, accepted sales order and delivery commitments |
| 05 Planning | Demand, material readiness, MRP recommendations, capacity and work orders |
| 06 Material readiness | Procurement, QC-held receipts, reservations, usable stock and material kits |
| 07 Tooling/machine readiness | Machine/tool/gauge availability, calibration/maintenance evidence and setup gate |
| 08 Production execution | Ordered job cards, assignment, start/pause/resume, incremental good/scrap output and downtime |
| 09 WIP/movement | Issue, return, consumption, custody transfers and quantity reconciliation |
| 10 Quality control | Approved inspection plans, readings, results, NCR, holds and controlled dispositions |
| 11 External/job work | Vendor outward custody, partial returns, losses, charges and incoming QC |
| 12 Assembly/secondary operations | Optional pinned assembly/secondary route; actual input consumption and genealogy |
| 13 Finished-goods release | Output on hold, current inspection/review gate and lot release |
| 14 Packing | Quantity/lot allocation, package contents, scan verification and printable labels |
| 15 Dispatch planning | Partial shipment allocations, package selection, carrier and document references |
| 16 Dispatch | Final current QC/quantity/package check, signed ledger/custody event and shipment confirmation |

## 12. Master data, engineering and commercial features

### Masters

Support customers/suppliers and contacts, item codes/search aliases, customer part numbers, configurable material/grade/finish descriptors, base UOM, currency, warehouse/bin, work centre, machine, tooling, gauges, shifts and commercial terms. Reject duplicate active identifiers within the intended company scope; show likely duplicate parties without automatically merging them.

Treat kg-to-pieces relationships as approved measured conversions with original input quantity/unit, explicit basis and revision. Never guess a conversion or silently replace original measurements. Include bulk master import with preview, validation, conflicts and audit; invalid rows must not result in a half-applied batch.

### Engineering and feasibility

Store drawing files as immutable versions with original reference and checksum. BOMs specify an explicit output basis and component quantities/units; routings specify ordered operations, required equipment and optional inspection points. Validate nonempty recipes/routes, approved inputs, coherent units and version pins. Draft revisions can change; approved versions cannot.

Feasibility reviews are per RFQ/order line and current requirement revision. Record feasible/conditional/not-feasible, reason, required tooling, approved route and any requirement still missing. Requirement revisions invalidate stale reviews/approvals rather than reusing them silently. Manufacturing methods and tolerances are configurable SAMPLE proposals, not hardcoded SOP.

### Commercial flow

RFQ states: new, awaiting_information, under_review, qualified, quoted, converted, lost or cancelled. Quotes: draft, pending_approval, approved, sent_recorded, accepted, rejected, expired or superseded. Sales orders: draft, pending_acceptance, accepted, partially_fulfilled, fulfilled, closed or cancelled. Write explicit allowed transitions and cancellation gates, including already reserved/produced/shipped quantities.

Capture interactions and follow-up dates without sending messages externally. Cost sheets include material, process, subcontract, packing, freight and overhead inputs; compare exact calculated cost/price/margin using explicit rounding. Pricing/terms/revision approvals are auditable. Record customer PO matching issues for price, quantity, delivery, drawing and terms; unresolved blocking mismatches prevent acceptance.

Accept an order only against valid current requirements and approved quote/engineering pins. Support partial deliveries and controlled amendments after work begins. Preserve accepted historical obligations; amendments do not silently rewrite fulfilled quantities. Provide approved quote/order prints with revision and SAMPLE watermark for fictional data.

## 13. Procurement, stock and warehouse features

Create purchase requisitions from demand or explicit requests, allocate them across multiple POs, and preserve the remaining unallocated quantity. Purchase orders have draft/approval/open/partial_receipt/received/closed/cancelled transitions and quantity/approval gates. Supplier prices and lead times are configured inputs, not invented recommendations.

Receive partial quantities against remaining PO obligations in one command; record supplier lot/heat/certificate references, dates, quantities and warehouse location. Create a held stock lot and receipt ledger events atomically. Receipt return is bounded by the actual remaining received stock and vendor-return authorization. A cancelled PO does not erase receipts.

Provide stock explorer by item/lot/location and separate projections for usable, reserved, QC-held, WIP and at-vendor quantities. Every balance shows units and as-of confirmation. Implement reservation/release, pick/issue, material return, transfers, split/merge and count workflows. Reservation must not exceed usable unreserved stock. Counts have draft/submitted/reviewed/applied states and independent review when the team policy requires it.

Lot split/merge conserves exact quantities and records parent/child genealogy. Validate item/specification/unit compatibility; disallow merging incompatible or held material into a released lot. New destinations require the applicable QC gate. Do not fabricate proportional material allocations beyond the evidence recorded.

Global barcode/QR lookup handles item, lot, job, work order, package and shipment identities through exact scoped lookup. Keyboard-wedge scanners work on desktop/web; camera scanning works on supported mobile/web environments after permission/capability checks. Unknown, duplicate, malformed and unauthorized codes have distinct safe outcomes. Manual entry always exists.

## 14. Planning, production, WIP and equipment

MRP uses accepted demand, approved engineering, available usable stock and expected receipts as separate facts. Suggestions can produce requisitions or work orders only through explicit operator commands. No automatic PO approval or implicit stock commitment. Capacity uses recorded shifts, work-centre availability and allocations; two planners cannot reserve the same exclusive slot concurrently.

Work orders pin the accepted sales line and engineering package. States: draft, released, in_progress, blocked, completed, closed or cancelled. Release creates ordered job cards only after required material/equipment conditions pass. Job cards have ready, active, paused, completed or cancelled states; predecessors, role/assignment and machine readiness are checked when starting.

Provide job assignment, start/pause/resume, downtime reason, incremental good/scrap quantities, material requests and operator notes. Prevent double counting on duplicate taps/retries. Do not infer full-day production from a timer alone or retroactively alter submitted output without correction evidence.

Material issue moves stores custody to the work/job. Return restores bounded unconsumed custody to held stock; consume accounts for material actually used. WIP remains independently visible. Final output requires required material consumption and creates held output lots with genealogy from actually consumed lots. A routed NCR rework exception must be tied to the exact authorized source, not a general QC bypass.

Close work only after job completion, material/output/scrap reconciliation and applicable lot dispositions. Open physical work cannot disappear through closing or deleting its record. Assembly uses the same work-order/material/output boundaries; do not create a second unrelated inventory engine.

Equipment features include active/inactive state, ready/unavailable/maintenance status, calibration validity for measuring gauges, approved assignment and auditable readiness changes. Required expired/unavailable equipment blocks job start or inspection with a reason. Include simple maintenance/calibration history and due alerts, without PLC/telemetry integration or invented predictive maintenance.

## 15. Quality, NCR, subcontracting and traceability

Quality plans are immutable approved versions with item/context, characteristic keys, units, numeric limits or attribute values, sampling count and required gauge. SAMPLE readings/limits must be labeled fictional. The authority evaluates readings exactly; clients do not submit an authoritative `passed: true` to bypass calculation.

Inspections record plan revision, material/job/output target, exact submitted samples, inspector and evidence. Reject missing/extra/duplicate characteristics, incompatible units, wrong sample count, stale target revision and unusable gauges. Corrections are superseding inspections; original records remain readable.

An NCR contains affected quantity, defect, evidence, containment and current disposition. Containment puts the lot on hold, including material already reserved or prepared for packing. Dispositions cover reinspection, authorized scrap, supplier return, routed rework or configured concession. Record required independent review/owner attestation. Authorization does not falsely mark physical return/rework complete: remain awaiting_execution until bounded actual events reconcile it.

Lot release requires current passed inspection, resolved blocking NCRs and explicit release permission/policy. Recheck at material issue, packing and dispatch; a release displayed yesterday cannot override a new hold.

Subcontract orders track input lots, vendor/location custody, planned processing, required dates and quantities. Outward shipment removes stores availability into vendor custody; partial return accounts for returned good/reject material and creates held stock/output. Record explicit authorized loss and remaining vendor quantity. Keep the invariant that returned + loss cannot exceed outward custody; unresolved difference remains visible, not auto-written-off.

Traceability provides backward and forward navigation through supplier receipt/certificate, input lots, material events, jobs, inspections, split/merge/rework/assembly outputs, packages, shipments and customer returns. Apply permissions to every linked record and attachment. Missing historical evidence is shown as missing, never invented.

## 16. Packing, dispatch, returns and documents

Packing starts from released available stock or a valid shipment allocation. Record package identifier, actual lot quantities, packaging description and exact contents. Validate reservation/custody so package quantities cannot be promised twice. Scan expected item/lot/package identities; show missing, extra or mismatched scans before verification. Labels include human-readable IDs, quantities/units, lot references and barcode/QR without personal data.

Shipment preparation selects verified packages and remaining accepted order quantities; record carrier/vehicle and document references without creating statutory filings. Dispatch is a single trusted command that rechecks quantities, company/plant, packages, lot release, changed QC holds, order obligations and revision. Post ledger/custody and shipment events once. Partial dispatch keeps the sales order partially fulfilled.

Customer returns reference original shipment/package/lot and are limited to quantities actually shipped minus prior returns. Receipt creates held return stock and genealogy; it does not silently reverse commercial payment or release material for reuse. Correct mistaken dispatch through a permitted compensating event with physically reconciled custody, not deletion.

Private documents include drawings, certificates, supplier evidence, inspection photos and signed/reference records. Store immutable bytes with hash, size, MIME type, version, uploader/provenance and scoped links. Treat uploaded filenames and document content as untrusted. No executable attachment content or arbitrary HTML is loaded with native privileges. Preview unsupported formats safely through download/open flows with explicit confirmation where appropriate.

Commercial PDFs, packing labels and operational exports are generated from approved versioned data. Rendering a PDF cannot itself approve, reserve or dispatch records. Printed fictional data is visibly marked SAMPLE. Actual label dimensions, scanner/printer models and physical readability remain device acceptance tasks.

## 17. Reports, search, dashboards and notifications

Implement permission-filtered reports for open RFQs/quotes/orders, shortages, PO/receipt status, stock by custody/QC/reservation, WIP and overdue jobs, production good/scrap, NCR ageing/rework, vendor reconciliation, package/dispatch status, equipment readiness and commercial/accounting handoff.

Every report supports relevant company/plant/date/item/party/status filters, cursor/server pagination, units/currency and an as-of indicator. Do not total kg and pieces or different currencies together. Avoid loading all ledger history into a phone/browser to compute a report. Export is separately authorized and logged; escape spreadsheet formula injection in CSV text cells.

The Order Command Center shows current customer/order requirements, pinned revisions, demand, material readiness, linked WOs/jobs, QC/vendor blockers, packages and fulfilled/remaining deliveries. Dashboard tiles link to the filtered records that produce their totals. Urgent and blocked are different; show `Blocked because ...` with the required next action.

Global search returns only permitted records and exact scanner results. Implement record history, related links and audit timeline with stable pagination. In-app notifications cover assignments, approvals, shortages, holds, overdue commitments and backup failure; retries do not duplicate them. Device push notifications are opt-in and contain minimal content. External email/WhatsApp workflow integrations are outside this build except explicitly authorized Auth/invitation delivery.

## 18. UI, platform surfaces and accessibility

Use semantic design tokens for colors, spacing, font sizes, radii, focus and touch targets. Support light/dark preference and readable contrast without introducing unrelated visual themes. Status is text + icon + reason, never color alone. Provide keyboard operation, visible focus, labels on icon buttons and accessible validation/error messages. Aim for at least 44 logical pixels for mobile touch actions through centralized tokens.

### Web and Electron

Use a familiar operations layout: company/workspace and plant selectors, authority/network/save indicator, global search, module sidebar, breadcrumb, dense filterable tables, record detail views and contextual action dialogs. Desktop supports keyboard shortcuts, scanner input, file picker, printing/PDF export, backup location selection and update readiness. Web supports responsive layouts and optional PWA installation; ordinary browser access remains allowed and installation is not a security control.

### React Native

Deliver native screens, not a WebView of the website. Use Home, Work, Scan, Approvals and More navigation with role-aware shortcuts. Full permitted record lists/details and actions remain reachable; operators see assigned work, stores users see scan/receive/pick, reviewers see evidence/approval and managers see drill-down reports. Phone forms use step sections; tablet layouts use additional detail space. Heavy bulk setup/import can remain desktop/web optimized with an explicit mobile capability message, while ordinary company creation and membership administration are available to authorized mobile users.

Handle back navigation with unsaved changes, keyboard-safe forms, denied camera permission, document picking, unavailable printers, offline drafts and expired sessions. Label mode continuously: `Solo — saved on this device` or `Team — saved to company server`. Show actual committed/unknown/unsent state, not a success toast on click.

### Route responsibility map

Implement corresponding web/desktop routes and native screens for welcome/mode selection, authentication/recovery/invite, workspace/company selection, company setup/settings, members/roles, overview, masters, engineering, sales, planning, procurement, stock, production, quality, jobwork, equipment, packing/dispatch, reports, record detail/history, documents and backup/restore/cutover. Use shared feature controllers, not one giant route component that also runs SQL or filesystem code.

## 19. Electron and native runtime boundaries

The Electron renderer loads bundled local assets. It has no Node integration and uses context isolation, renderer sandboxing, a restrictive CSP and allowlisted navigation/external links. A typed preload bridge exposes individual approved methods, never arbitrary SQL, filesystem paths, shell commands or generic IPC forwarding. Verify IPC sender/frame, workspace identity, schemas and size limits in the receiving process. Return structured domain errors explicitly; do not rely on Electron exception serialization retaining custom fields.

A utility process owns native SQLite connections and serialized local commands. The main process owns OS dialogs, windows, printing, secure credential storage and update lifecycle. Untrusted documents do not execute in either privileged process. Resolve managed paths within approved workspace roots; prevent traversal/symlinks and arbitrary user-supplied file deletion. Use app user-data storage, not installation directories.

Acquire a single-instance/writer lock; a worker crash changes UI to unavailable/confirmation-unknown, not false success. On restart, recover committed results through idempotency history. Use native SQLite backup APIs and verified packaged native binaries. Installation and runtime must work on a clean Windows test machine without development Node.js or a manually installed SQLite server.

React Native local storage uses one explicit transaction-owning repository. Ordinary async queries must not accidentally join an unrelated in-flight transaction. Use the supported exclusive transaction mechanism on native, a bounded connection/queue strategy and real concurrency tests. Do not rely on a web-only SQLite implementation for Android parity. Expo Go is not release proof; test an actual development/release build with the required native modules.

Web storage runs only in its worker; require actual OPFS capability and storage-health checks, stable origin identity and a single writer. Configure isolation headers for the chosen SQLite VFS and test their effects on Supabase Auth, Storage and attachments. A changed hosting origin is a different local workspace; provide explicit export/import rather than pretending local data follows a URL change.

## 20. Backups, recovery, migrations and cutover

### Local snapshot format

Implement one versioned portable snapshot contract across all clients: a consistent SQLite database snapshot, immutable referenced document bytes, workspace identity/provenance, schema/contract version, manifest, entry sizes and cryptographic hashes. Lock/quiesce writes long enough to capture a consistent point; do not copy a live database file while ignoring WAL/journal state. Ensure attachments referenced by the snapshot are ready and immutable.

The portable database is a standalone consistent file in a journal mode accepted by every supported runtime. Do not export a WAL-dependent database plus missing sidecars and expect the WASM client to read it. Prove native-to-WASM and WASM-to-native compatibility against the pinned SQLite builds. Disable extension loading and validate restored schema against the permitted version before trusting its triggers/views.

Encrypt exports with AES-256-GCM using a fresh cryptographically secure nonce and salt, authenticated version/header metadata and a passphrase-derived key. Use maintained platform crypto APIs through a tested adapter; use PBKDF2-HMAC-SHA256 with a documented work factor selected against current guidance and device measurements. Encode KDF parameters in the envelope, validate supported cost bounds and fail on authentication error. Never invent a cipher or reuse a nonce/key pair. Share cross-platform known-answer and round-trip tests. Recovery requires the passphrase; cloud account access alone does not decrypt a backup.

Keep plaintext temporary material inside protected managed storage and remove it on failure/completion. Do not upload passphrases or plaintext snapshots. Local live databases are OS-protected files; do not advertise database-at-rest encryption unless a separately validated implementation actually provides it. Encrypted backups and secure token storage do not encrypt the live SQLite file.

### Scheduling and cloud backup

Desktop supports an opt-in backup destination outside the workspace and automatic backups while the app runs, with overdue backup handling on next launch. Default proposed cadence: every 24 hours, retaining the latest 30 successful snapshots; failed new backups never delete the last good copy. Backups on the same disk do not protect against disk/device loss. A closed app is not a reliable scheduler; an OS background service is a separate future decision.

Mobile/web provide export/share and optional account-owned encrypted upload, with last-success/failure indicators. Do not promise unattended background backup when Android/browser lifecycle rules prevent it. Uploading a backup requires explicit user opt-in and a signed-in account; solo operations remain usable without an account. Cloud metadata and blob policies are account-owned and isolated from team/company files.

### Restore and schema evolution

Restore into a new temporary workspace first. Validate envelope, KDF limits, archive path traversal/size limits, entry hashes, expected schema, supported version, SQLite integrity, foreign keys, decimal representation, append-only invariants, stock/custody reconciliation and document references. Reject unexpected executable/schema extensions. Preview the identified workspace/date/counts before activation. Do not replace the active good workspace until all checks succeed; retain its recovery copy.

Support explicit portable movement between desktop/mobile/web with cross-runtime restore tests. Imported local provenance remains local; restore cannot generate cloud role assignments or trusted independent approval identities. Archived solo history remains readable.

Version cloud and SQLite migrations, record checksums and take a recoverable snapshot before local data upgrades. An incompatible newer backup cannot be silently opened by an older client. Failed local migration preserves the old data and offers recovery. Separate application binary rollback from schema compatibility; never run destructive downgrade SQL because an updater rolled back.

### Team operations

Document actual hosted database backup retention and separately cover private Storage bytes; do not assume a database backup includes attachment contents. Provide encrypted operational exports, staging restore drills and evidence that RLS, membership, ledger and files restore together. Use runner-only secrets, not client credentials. Real backup schedule activation and production restore are owner-approved operational steps.

Implement the solo-to-team cutover described in section 5 as a late, separately tested vertical slice with source fingerprint, validated mappings, idempotent staged import, all-or-nothing activation and held opening stock. No generic `sync all` button.

## 21. Controlled import/export and operational safeguards

Imports have upload/source preservation, parse, preview, mapping, validation and atomic apply states. Stage only supported master/opening data; enforce permissions, company/plant relationships, exact decimals, units, duplicates and required approvals. Unsafe arbitrary SQL dumps are not an import feature. Original source, validation findings and applied mapping remain auditable.

Accounting exports are immutable approved snapshots of supported business events, with explicit date/unit/currency and mapping version. Re-export can reproduce the same approved snapshot. CSV is not a claim of compatible Tally import; direct format compatibility requires its own tested mapping and approval.

Use bounded file sizes, pagination, query indexes, command timeouts and structured redacted logging. Audit includes actor/provenance, company/plant/workspace, entity, action, request key/correlation, timestamp, prior/new state references, reason and quantity where relevant. No passwords, tokens, entire sensitive files or connection strings in logs or diagnostics.

## 22. Delivery, configuration and release artifacts

Provide `.env.example` files containing public Supabase URL/key placeholders and app identifiers only. Server-only function/runner secrets are documented in deployment instructions and configured outside clients. Supabase projects, signing accounts and paid services are not silently created or purchased by an implementation agent.

Web deploys a static HTTPS build with PWA assets and applicable COOP/COEP/CSP headers. Updates require an explicit reload prompt and cannot interrupt an unresolved command. Cache versioning and old-client API compatibility are tested.

Electron delivers a Windows installer containing all required assets and native dependencies, documented code-signing configuration, versioned update feed, release notes and migration-safe restart flow. Download/verify updates before activation and require restart at a safe point. Never install unverified downloaded code through a custom update script.

Android delivers reproducible debug/development APK, tested release APK and store-ready AAB build instructions. Use signing secrets outside source. Account for native-binary/module changes versus compatible JS updates; do not promise arbitrary native changes through over-the-air JavaScript delivery. Mobile releases must match compatible server contracts.

Use Semantic Versioning and honest Conventional Commits. Automate typecheck, lint, unit/domain tests, SQL/RLS tests, all SQLite adapters, web/Electron E2E, native Android smoke/flows, build and artifact checks. Store checksums/release evidence. Production hosting, real invitations/messages, store publication and signed public release require explicit owner authorization at that step; creating the software and local SAMPLE artifacts is authorized by the build request.

## 23. Build milestones and stop conditions

This is a large product, so build a sequence of working vertical slices. Do not finish the whole backend before any client can exercise it, and do not generate all screens before any command works. Maintain a task board with files/interfaces, dependencies, migrations, happy/failure/concurrency tests and exact command/results.

| Milestone | Deliverable | Gate before completion |
|---|---|---|
| M0 Contract/tooling | Monorepo, identical agent contracts, architecture/ERD, pinned dependency matrix, platform shells | All three apps launch; import boundaries/typecheck/lint work; no fake business success |
| M1 Identity/tenancy | Real Auth, create company, membership/invites/roles, multi-company selector | Two-company RLS isolation, last-owner/delegation/revocation tests; clients exercise the same backend |
| M2 Solo foundation | Real SQLite schema/adapters, local company/workspace creation, exact values, snapshot/restore baseline | All three runtimes persist across restart; rollback/idempotency/writer-lock proof; solo starts without Supabase |
| M3 Masters/engineering | Parties, items/units, private documents, immutable drawing/BOM/routing, current feasibility | Version pins and file/tenant permissions pass against cloud and local authorities |
| M4 Commercial dispatch slice | RFQ/quote/PO-match/SO, minimal held receipt/inspection/release, and reserve/pack/dispatch from approved SAMPLE finished stock | A real full happy path and failed QC/quantity/revision paths pass; phone/desktop/web can inspect it |
| M5 Materials/procurement | Requisition allocation, PO approval, partial held GRN, return, stock/count/transfer | Exact balance and concurrent receipt/reservation/count tests pass |
| M6 Production/equipment | MRP, WOs/jobs, capacity/readiness, issue/return/consume, output/scrap | Actual material/output reconciliation and safe close/start gates pass |
| M7 Quality/job work | Inspections, holds, NCR/rework, release, vendor custody, split/merge/assembly genealogy | Independent review in team, honest owner attestation in solo, no QC bypass, traceability tests pass |
| M8 Operational breadth | Reports, search/scans, returns, approved exports, native UX/printing, notifications | Paginated scoped reads and real scan/print/native workflow proof; no stubbed enabled actions |
| M9 Recovery/cutover | Cross-platform encrypted restore, optional backups, reviewed solo-to-team move | Corrupt/wrong-key/failure tests preserve source; no partial cloud activation; opening stock on hold |
| M10 Delivery/pilot | Windows installer, Android artifacts, hosted staging web, restore evidence and operations guide | Clean-machine/device acceptance with SAMPLE; production remains a distinct approved rollout |

At an intermediate milestone, unavailable actions are visibly disabled with a reason and recorded on the board. Final scope is complete only when every enabled action has a real authority path and every milestone acceptance gate is met. Do not expand into unrelated accounting/AI/telemetry projects to compensate for incomplete factory workflows.

M4 includes the minimal stock/QC foundation needed to ship honestly; M5 and M7 expand those modules. Do not bypass release rules or mark arbitrary seeded balances approved solely to postpone prerequisite implementation.

## 24. Mandatory acceptance and failure tests

Maintain a traceability matrix mapping each feature/command to authority, role, runtime and acceptance evidence. Use shared input/expected-result vectors for equivalent PostgreSQL and SQLite behavior, but run actual databases rather than comparing mocks. Test every native adapter independently; Node-only SQLite tests do not prove Expo or OPFS behavior.

1. **Company creation:** verified creator becomes Owner once; duplicate retry creates no duplicate company/plant; supplied fake owner/role is rejected; unverified/no-session creation fails.
2. **Tenant isolation:** Company A cannot read/write/search/export/download/subscribe to Company B; cross-company foreign keys and IDs fail; company switching cannot flash previous data.
3. **RBAC:** direct API/RPC access remains denied when a UI button is hidden; operator scope works; invite token replay/wrong identity fails; delegation escalation and last-owner removal fail; revoked membership loses current access with an otherwise valid token.
4. **Solo independence:** fresh installed desktop/mobile opens and creates data without cloud configuration; web solo works after assets are cached; unsupported storage visibly fails; no cloud request is required for local business commands.
5. **Persistence:** restart desktop/app/browser after offline writes; records and files survive; fail/crash a transaction and prove all-or-nothing domain/ledger/audit changes; second writer cannot corrupt the workspace.
6. **Exact values:** decimal quantities/prices/measurements, large IDs and rounding cases remain exact through JSON, SQLite, PostgreSQL, reports and export; incompatible units are rejected.
7. **Commercial:** requirement amendment invalidates stale feasibility; unapproved/stale quote or unresolved PO discrepancy cannot accept; accepted versions remain pinned.
8. **Concurrency/idempotency:** two users reserving the last stock cannot both succeed; duplicate receiving/output/dispatch retry posts once; reused key with changed payload fails; stale revision leaves records unchanged.
9. **Procurement:** split requisitions and partial receipts reconcile; over-allocation/over-receipt/over-return fails; received stock remains held until valid release.
10. **Production:** missing predecessor/material/equipment blocks start/release; return/consume cannot exceed custody; output needs actual consumption; close cannot discard open WIP or unreconciled scrap.
11. **QC:** wrong plan/unit/sample count and stale inspection fail; failed/latest inspection or unresolved NCR blocks release; team self-review restriction is enforced; solo never claims independent review.
12. **Changed hold:** hold a previously reserved/packed lot, then prove issue/packing/dispatch rejects until a valid current release.
13. **Vendor/genealogy:** partial outward/returns/loss/split/merge/assembly preserve exact custody and parentage; quantities cannot be duplicated or disappear.
14. **Dispatch/returns:** wrong/missing/extra package scan fails; partial fulfillment remains open; duplicate shipment and excessive customer return fail; returned stock is held.
15. **Private files:** unauthorized company/member/expired access fails; path traversal and mismatched hash/size fail; failed staging finalization leaves no approved dangling file.
16. **Offline team:** disconnect during a command and show unknown confirmation; same-key reconnect resolves once; offline critical actions cannot enter solo or an automatic write queue.
17. **Native security:** forged IPC sender, arbitrary SQL/path/shell payload, malicious attachment/navigation and leaked server-secret scans fail safely; packaged SQLite native module runs on clean Windows.
18. **Backup:** desktop/mobile/web export and cross-restore; corruption, wrong passphrase, excessive archive/KDF cost, missing document, incompatible schema and failed upgrade never replace good data.
19. **Cutover:** open WIP/vendor/NCR/reservations block acceptance; invalid preview/import preserves solo; retry imports once; openings are held; successful move retains readable local archive and then freezes writes.
20. **UX/device:** keyboard/focus/screen-reader semantics, Android back/keyboard/camera-denial flows, manual scan entry, actual label readability, safe update/restart and clear authority/save indicators.
21. **Operations:** restore team database and private files to isolated staging; verify RLS/membership/history after restore; prove update compatibility and keep explicit pending status for missing signing/device/production evidence.

## 25. Receiving agent execution contract and final deliverables

Before coding, summarize this architecture and the next smallest slice, inspect the target repository and record any material contradiction. The owner authorized this blueprint; do not repeatedly ask permission for reversible implementation within its scope. Ask only when an unresolved choice materially changes product authority/security, or when production/external actions require authorization. Infrastructure/signing credentials are deployment inputs, not reasons to pretend a SAMPLE build failed or succeeded.

Create the engineering contract in identical `AGENTS.md` and `CLAUDE.md` files and keep it the sole rule hub. Supporting docs explain implementation; they must not silently add conflicting rules. Write sequential ADRs for product/architecture, permissions/API surfaces, stored formats, dependencies/build/release steps and contract changes; amend related decisions instead of overwriting history. Create focused task records before changes, list their files/interfaces and prevent concurrent agents from editing the same feature/migration.

Reuse existing code when applicable; keep presentation pure; use narrow typed privileged boundaries; keep files focused; pin versions; preserve records; never bypass checks/hooks or force-push main. Validate each slice with meaningful happy/failure and relevant concurrency tests. Record exact validation commands and results; a missing device/credential gate remains pending. Update architecture/domain/security/workflow docs with their owning change. A pass in one authority/runtime is not proof for another.

Create and document root commands for `dev:web`, `dev:desktop`, `dev:mobile`, `typecheck`, `lint`, `test`, `test:db`, `test:local`, `test:parity`, `e2e:web`, `e2e:desktop`, `e2e:mobile`, `test:restore`, `build:web`, `build:desktop`, `build:mobile` and `check`. Discover version-specific CLI syntax through official docs and `--help`; don't assert unimplemented scripts are available. CI must actually invoke these gates or clearly separated equivalents, with secrets and device requirements documented.

Final delivery includes runnable source, migration history, reproducible SAMPLE data, all three applications, Windows installer and Android build artifacts, staging-ready web bundle, setup/run/build/test instructions, permissions matrix and ERD, complete feature/authority/runtime test evidence, backup/restore and cutover instructions, release/update configuration, and an honest list of remaining real-device/signing/production inputs. Never claim certification, real factory rollout or statutory compliance from automated SAMPLE tests.

**Begin with M0 and M1/M2 foundations, then deliver one complete commercial-to-dispatch slice before widening the ERP. Continue until the authorized scope is complete, keeping each committed slice usable and reviewable.**

## 26. Official documentation checkpoints

These links support technology selection and security boundaries; they are not verified factory SOP. Consult current stable docs and changelogs before implementing version-sensitive APIs. Exact versions and commands belong in the receiving repository's pinned dependency matrix and validation evidence.

- [React](https://react.dev/), [Vite](https://vite.dev/guide/), [React Router](https://reactrouter.com/), [TanStack Query](https://tanstack.com/query/latest), [Vite PWA](https://vite-pwa-org.netlify.app/guide/).
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc), [utility process](https://www.electronjs.org/docs/latest/api/utility-process), [secure storage](https://www.electronjs.org/docs/latest/api/safe-storage), [updates](https://www.electronjs.org/docs/latest/tutorial/updates), [electron-builder](https://www.electron.build/).
- [React Native](https://reactnative.dev/docs/getting-started), [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/), [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/).
- [SQLite WASM persistent storage](https://sqlite.org/wasm/doc/tip/persistence.md), [SQLite backup API](https://sqlite.org/backup.html), [SQLite transactions](https://sqlite.org/lang_transaction.html).
- [Supabase changelog](https://supabase.com/changelog), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [secure data](https://supabase.com/docs/guides/database/secure-data), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Edge Function authentication](https://supabase.com/docs/guides/functions/auth), [React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native), [CLI](https://supabase.com/docs/reference/cli/introduction).

Current checkpoint: Supabase's changelog announces removal of older TLS 1.2 cipher suites from project HTTP APIs on 2026-11-10. Validate the selected desktop/mobile/browser network runtimes against current supported TLS; do not select an obsolete runtime to avoid an unrelated dependency upgrade. This checkpoint must be reverified if the build starts later.
