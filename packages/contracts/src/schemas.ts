import { z } from 'zod';
export const decimalSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,23})(\.\d{1,6})?$/,
    'Use a nonnegative decimal, at most six decimal places',
  );
export const identifierSchema = z.string().uuid();
export const authoritySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('solo'), workspaceId: identifierSchema }).strict(),
  z
    .object({
      kind: z.literal('team'),
      companyId: identifierSchema,
      plantId: identifierSchema.optional(),
    })
    .strict(),
]);
export const entityKinds = [
  'customer',
  'supplier',
  'item',
  'engineering',
  'rfq',
  'quotation',
  'sales_order',
  'purchase_order',
  'work_order',
  'equipment',
  'ncr',
  'jobwork',
] as const;
export const entityKindSchema = z.enum(entityKinds);
export const fieldsSchema = z.record(z.string().max(64), z.string().max(4000));
export const errorCodes = [
  'AUTH_REQUIRED',
  'PERMISSION_DENIED',
  'COMPANY_SCOPE_MISMATCH',
  'INVALID_INPUT',
  'INVALID_TRANSITION',
  'REVISION_CONFLICT',
  'IDEMPOTENCY_KEY_REUSED',
  'INSUFFICIENT_AVAILABLE_STOCK',
  'LOT_QC_HOLD',
  'UNIT_MISMATCH',
  'INSPECTION_REQUIRED',
  'INDEPENDENT_REVIEW_REQUIRED',
  'EQUIPMENT_NOT_READY',
  'OFFLINE_TEAM_WRITE_BLOCKED',
  'WORKSPACE_BUSY',
  'STORAGE_UNAVAILABLE',
  'BACKUP_INVALID',
  'SCHEMA_INCOMPATIBLE',
  'CONFIRMATION_UNKNOWN',
] as const;
