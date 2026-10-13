# TASK-0002 — Team authority and tenancy

## Scope and ownership

The primary agent owns `supabase/**`, cloud repository, database type generation/validation operations, and cloud security suites. No concurrent migration editing. Development uses local Supabase and fictional SAMPLE records; hosted resources and real messages are release inputs.

## Interfaces

The client calls `create_company(input jsonb, request_key uuid)`, `execute_command(request jsonb)`, `workspace_snapshot(authority jsonb)`, and `list_workspaces()`. Invitation and membership administration have narrowly scoped RPCs. Actors derive from Auth; requests never supply trusted membership or reviewer identity. The initial cloud schema mirrors the limited business slice, not every proposed normalized domain.

## Acceptance

Require verified company creation and same-key deduplication, two-company/plant isolation, direct mutation denial, active membership revocation, role delegation/last-owner protection, current QC/quantity gates, retry conflicts, and atomic domain/ledger/audit updates. Role templates and permission policies must be tested against actual PostgreSQL. Generated row types remain separate from business DTOs.

## Evidence and remaining gates

Actual local SQL/RLS suite passed 58 assertions; signed Auth/HTTP passed 8 checks. The SDK uses generated Database types and validates read/command/admin DTOs. Operational references permit Stores receipts/reservations without exposing commercial fields. Concurrent PostgreSQL contention, complete signed multi-role UI, callback/MFA recovery and administration transport recovery remain pending. Hosted Auth delivery, production MFA configuration, storage lifecycle, cloud backup and staging restore remain explicit gates. Unit/client checks alone do not prove database authorization.
