# Domain Model and Data Ownership

The full logical model is specified in handoff section 10. The initial slice deliberately implements only dependent tables instead of generating empty modules.

## Current concepts

Workspace/company identity, plant scope, protected memberships/roles/grants; validated party/item/engineering/commercial/work/equipment/NCR drafts; physical lot; signed ledger; reservation; numeric inspection; verified package; shipment; local genealogy; actor/provenance audit and idempotency result.

Each record kind has its own transitions. Item identity is distinct from engineering revision; reservation is distinct from physical stock; inspection is distinct from release; prepared package is distinct from actual dispatch. Actor identity is derived by the authority, not trusted from form payloads.

Stores/WIP/vendor/consumed/shipped/loss custody is recorded explicitly. Quantities are scaled exact values and projections, never freely editable balances. Receipts and physical returns create held stock. Approved drawing references are immutable; full specification/BOM/routing/document versions remain dependent schema work.

## Expansion boundary

Do not overload the initial JSON draft record into a claim of complete normalized engineering, purchase allocation, job cards, measurement characteristics, maintenance or import/export snapshots. Those slices add their own normalized constraints and ERDs with tests. Do not cascade deletion through history or rewrite old events when settings change.
