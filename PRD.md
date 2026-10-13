# Product Requirements Document

## Product and authority

Fasteners Factory ERP is an operations application for fastener and precision-component manufacturing. Desktop is the active first-release client. Team collaboration uses Supabase PostgreSQL/Auth; independent solo work uses native SQLite. Browser solo uses worker-owned SQLite WASM/OPFS. Mobile is deferred.

An accepted write has a committed authority transaction. Team uncertainty is `Confirmation unknown`; the original request key is retained. Team writes never silently fall back to SQLite. Solo requires no account. Multiple named workspaces have immutable UUIDs and local owner provenance.

Cloud accounts may own or belong to several companies. Permissions are action + company + plant/resource scope, derived from current protected membership. Fixed role bundles can be combined and explicit non-ownership grants can be assigned within delegation rights. Independent reviews compare actual actor identities; Owner status is not a QC override.

## Required operational capabilities

The complete baseline requires administration/onboarding; customers/suppliers and exact item units; versioned specifications/drawings/BOM/routings and feasibility; RFQs/costs/quotes/PO matching/accepted orders; procurement; append-only inventory and custody; planning and production; quality/NCR; subcontracting/assembly; packing/dispatch/returns; equipment readiness; private documents; reports/search/scanning; controlled imports/exports; backup/restore/cutover; notifications and audit.

All 16 stages are independent objects and gates, not one universal status column. Finished-stock orders may skip manufacture. Repeated operations and parallel streams are permitted only through explicit recorded transitions. See `features.md` for feature-level delivery status and `docs/handoff.md` for the full authoritative detail.

## Invariants

- Quantities, prices and measurements are decimal strings, with explicit unit/currency. Exact local arithmetic uses scaled BigInt; PostgreSQL uses NUMERIC. No SQLite REAL or JavaScript floating-point domain truth.
- Stock is signed, append-only events. Reservations consume availability, not physical stock. Transfers and physical custody changes must reconcile; counts require difference events and reviews.
- Receipts, returns and output enter hold. Current QC state is checked again before issue, packing and dispatch.
- Approved engineering and accepted commercial obligations retain their historical pins. Stale revisions reject without partial changes.
- Duplicate request/key/payload returns its committed result. Key reuse with changed payload fails. Authorization is rechecked before cloud replay lookup.
- Private files, reports, search, counts, exports and downloads obey the same tenant and resource permissions as record details.
- Audit preserves actor/provenance, request correlation, reasons, affected records and commit time. Local audit is not tamper-proof against a device administrator.

## Initial delivered behavior and limits

The initial slice implements 12 record kinds with validated draft/master fields and distinct transition maps, immutable approved engineering references, quotation-backed order acceptance, PO-bounded partial held receipts, numeric inspection and release gates, reservation/packing/dispatch, and bounded held customer returns. Local services additionally implement material custody, transfer and vendor movements; their remaining production/reconciliation cases require further acceptance proof.

Initial engineering stores a drawing reference and operation sequence; it is not yet the full file/BOM/routing subsystem. Initial numeric inspection accepts explicit limits/readings; it is not yet approved multi-characteristic plans, gauge evidence or factory SOP. Record/report windows are bounded and labeled; full cursor pagination remains pending. Encrypted database export is distinct from full portable attachment backup and restore activation.

The feature matrix is mandatory when assessing completion. Unimplemented or unauthorized actions must be visibly unavailable with a reason. No attractive shell, generic record editor or partial SQL slice may be called the complete ERP.

## Defaults and acceptance

English, Windows 11 x64, INR and `Asia/Kolkata`, with currency/timezone explicitly configured at workspace/company creation. Fictional fixtures are opt-in and labeled SAMPLE. Physical printer/scanner acceptance, signing, hosted configuration and factory pilot remain separate proof. No statutory compliance is inferred from pricing, printouts or CSV.

## Delivered company setup recovery slice

Verified Team company creation retains the original fields and idempotency key on the device before sending. Confirmation unknown survives restart; retry uses the original account, backend and request. Another request cannot replace it. A storage failure or competing local writer blocks dispatch. A committed company remains committed when the company-list refresh fails, and the UI offers an independent refresh. This does not add solo synchronization or hosted infrastructure. Invitation/access/plant/ownership administration transport recovery remains pending.

## Delivered keyed administration recovery

Team invitation creation, member-access changes and plant/warehouse creation retain their original account/backend/company-bound request before dispatch. The same key and fields survive restart. Recovery must remain reachable when current membership is revoked or company reads fail; denied retries retain uncertain evidence. Storage failures block dispatch. New writes and scope changes in the current Team session stay blocked until confirmation/storage recovery. Confirmed commits, refresh failures and local cleanup failures have distinct outcomes. Returned invitation tokens are transient and never stored in request journals. Ownership/archive/policy transport recovery and invitation acceptance link/device recovery remain pending.
