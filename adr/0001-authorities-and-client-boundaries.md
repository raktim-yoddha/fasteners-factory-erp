# ADR 0001: Separate local and team authorities

Date: 2026-10-13. Status: accepted by the owner-approved plan.

Use independent device-local SQLite solo workspaces and Supabase team companies. Share contracts, pure exact domain utilities, controllers and behavior vectors. Reuse DOM presentation between browser and Electron; native mobile presentation remains separate and currently deferred.

No automatic synchronization or queued critical team writes. An explicit reviewed cutover later imports validated masters/openings and retains readable local provenance. The stronger separation prevents a cloud failure from silently changing the stock authority. It costs separate trusted SQLite/PostgreSQL implementations and parity proof.
