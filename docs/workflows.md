# Workflow and Authority Semantics

The complete 16-stage workflow is tracked in features.md and handoff section 11. Stages may be skipped, repeated or parallelized through their owning artifacts.

## Initial finished-stock path

Create customer/item → draft engineering reference and approve → draft quotation, submit and approve → draft quotation-backed sales order, resolve PO discrepancies and accept → receive held stock → record exact numeric inspection → release under local owner attestation or cloud review policy → reserve within stock/order availability → scan exact lot and verify package → confirm physical dispatch atomically → reconcile bounded customer return into held stock.

Cloud inspection/release may require distinct actors. Solo does not impersonate an independently authenticated reviewer. A new hold blocks prepared/reserved material, packing and dispatch, and invalidates old release evidence. Duplicate requests post once; changed key payload or stale revision rejects without partial state.

## Uncertain and offline outcomes

Solo writes are confirmed local transactions. Team critical writes require server confirmation. A lost response is unknown, not unsent success; preserve/retry the same key and inspect current state. A company switch is not an import. Independent workspaces never upload automatically or share a network SQLite file.

## Later slices

Actual production output needs approved component basis, bounded consumption and genealogy. NCR disposition authorization does not complete physical scrap/rework/return. Vendor returns/loss reconcile actual outward custody. Controlled imports/exports and cutover need preview, validation, provenance and atomic activation. These full workflows remain pending until their owning acceptance gates pass.
