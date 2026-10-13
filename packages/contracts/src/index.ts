import { z } from 'zod';

export {
  decimalSchema,
  identifierSchema,
  authoritySchema,
  entityKinds,
  entityKindSchema,
  fieldsSchema,
  errorCodes,
} from './schemas';
import {
  decimalSchema,
  identifierSchema,
  authoritySchema,
  entityKindSchema,
  fieldsSchema,
  errorCodes,
} from './schemas';
export type Authority = z.infer<typeof authoritySchema>;
export type EntityKind = z.infer<typeof entityKindSchema>;
export const commandPayloads = {
  save_record: z
    .object({
      kind: entityKindSchema,
      id: identifierSchema.optional(),
      code: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(200),
      fields: fieldsSchema,
    })
    .strict(),
  transition_record: z
    .object({
      id: identifierSchema,
      state: z.string().max(40),
      reason: z.string().max(500).optional(),
    })
    .strict(),
  receive_goods: z
    .object({
      itemId: identifierSchema,
      quantity: decimalSchema,
      location: z.string().min(1).max(80),
      supplierReference: z.string().max(120),
      purchaseOrderId: identifierSchema.optional(),
    })
    .strict(),
  record_inspection: z
    .object({
      lotId: identifierSchema,
      lower: decimalSchema,
      upper: decimalSchema,
      readings: z.array(decimalSchema).min(1).max(100),
      unit: z.string().min(1).max(20),
    })
    .strict(),
  release_lot: z.object({ lotId: identifierSchema }).strict(),
  hold_lot: z.object({ lotId: identifierSchema, reason: z.string().min(3).max(500) }).strict(),
  reserve_stock: z
    .object({ lotId: identifierSchema, orderId: identifierSchema, quantity: decimalSchema })
    .strict(),
  release_reservation: z.object({ reservationId: identifierSchema }).strict(),
  issue_material: z
    .object({ lotId: identifierSchema, workOrderId: identifierSchema, quantity: decimalSchema })
    .strict(),
  return_material: z
    .object({ lotId: identifierSchema, workOrderId: identifierSchema, quantity: decimalSchema })
    .strict(),
  consume_material: z
    .object({ lotId: identifierSchema, workOrderId: identifierSchema, quantity: decimalSchema })
    .strict(),
  record_production_output: z
    .object({
      workOrderId: identifierSchema,
      itemId: identifierSchema,
      quantity: decimalSchema,
      scrap: decimalSchema,
      location: z.string().min(1).max(80),
    })
    .strict(),
  transfer_stock: z
    .object({
      lotId: identifierSchema,
      quantity: decimalSchema,
      location: z.string().min(1).max(80),
    })
    .strict(),
  send_jobwork: z
    .object({ lotId: identifierSchema, supplierId: identifierSchema, quantity: decimalSchema })
    .strict(),
  receive_jobwork: z
    .object({
      lotId: identifierSchema,
      supplierId: identifierSchema,
      quantity: decimalSchema,
      loss: decimalSchema,
      reason: z.string().max(500),
    })
    .strict(),
  verify_packing: z
    .object({
      reservationId: identifierSchema,
      quantity: decimalSchema,
      scannedLotCode: z.string().min(1).max(80),
    })
    .strict(),
  confirm_dispatch: z
    .object({ packageId: identifierSchema, carrier: z.string().min(1).max(120) })
    .strict(),
  receive_customer_return: z
    .object({
      shipmentId: identifierSchema,
      quantity: decimalSchema,
      reason: z.string().min(3).max(500),
    })
    .strict(),
} as const;
export type CommandName = keyof typeof commandPayloads;
export type CommandPayloads = { [K in CommandName]: z.infer<(typeof commandPayloads)[K]> };
export type CommandPayload<K extends CommandName> = CommandPayloads[K];
export type CommandRequest = {
  [K in CommandName]: {
    contractVersion: 1;
    command: K;
    authority: Authority;
    idempotencyKey: string;
    expectedRevision?: string;
    payload: CommandPayload<K>;
  };
}[CommandName];
export const commandRequestSchema = z
  .object({
    contractVersion: z.literal(1),
    command: z.enum(Object.keys(commandPayloads) as [CommandName, ...CommandName[]]),
    authority: authoritySchema,
    idempotencyKey: identifierSchema,
    expectedRevision: z.string().regex(/^\d+$/).optional(),
    payload: z.unknown(),
  })
  .strict();
export function parseCommand(input: unknown): CommandRequest {
  const envelope = commandRequestSchema.parse(input);
  return {
    ...envelope,
    payload: commandPayloads[envelope.command].parse(envelope.payload),
  } as CommandRequest;
}
export type ErrorCode = (typeof errorCodes)[number];
export type CommandResult =
  | { ok: true; value: { id: string; message: string }; committedAt: string; authority: Authority }
  | {
      ok: false;
      error: { code: ErrorCode; message: string; retryable: boolean; correlationId: string };
    };
export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
export interface Workspace {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  createdAt: string;
}
export interface BusinessRecord {
  id: string;
  kind: EntityKind;
  code: string;
  name: string;
  state: string;
  revision: string;
  fields: Record<string, string>;
  createdAt: string;
}
export interface StockLot {
  id: string;
  code: string;
  itemId: string;
  itemName: string;
  unit: string;
  location: string;
  qcState: 'held' | 'released';
  onHand: string;
  reserved: string;
  available: string;
  wip: string;
  vendor: string;
  revision: string;
}
export interface Reservation {
  id: string;
  lotId: string;
  orderId: string;
  quantity: string;
  state: string;
}
export interface PackageRecord {
  id: string;
  reservationId: string;
  code: string;
  lotId: string;
  orderId: string;
  quantity: string;
  state: string;
}
export interface Shipment {
  id: string;
  code: string;
  lotId: string;
  orderId: string;
  quantity: string;
  carrier: string;
  createdAt: string;
}
export interface AuditEvent {
  id: string;
  command: string;
  entityId: string;
  actor: string;
  reason: string;
  createdAt: string;
}
export interface Snapshot {
  operationalOrders?: OperationalObligation[];
  operationalPurchaseOrders?: OperationalObligation[];
  plantId?: string;
  plants?: { id: string; name: string }[];
  workspace: Workspace;
  records: BusinessRecord[];
  lots: StockLot[];
  reservations: Reservation[];
  packages: PackageRecord[];
  shipments: Shipment[];
  audit: AuditEvent[];
  asOf: string;
  capabilities?: string[];
}
export interface OperationalObligation {
  id: string;
  code: string;
  itemId: string;
  quantity: string;
  state: string;
}
export interface CreateWorkspace {
  name: string;
  currency: string;
  timezone: string;
}
export interface Repository {
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(input: CreateWorkspace): Promise<Workspace>;
  snapshot(authority: Authority): Promise<Snapshot>;
  execute(request: CommandRequest): Promise<CommandResult>;
  close(): Promise<void>;
}
export function authorityKey(authority: Authority): string {
  return authority.kind === 'solo'
    ? `solo:${authority.workspaceId}`
    : `team:${authority.companyId}:${authority.plantId ?? '*'}`;
}
export { recordFields, type RecordField } from './forms';
export {
  permissions,
  rolePermissions,
  supportedTeamCommands,
  type Permission,
} from './permissions';
export {
  workspaceSchema,
  snapshotSchema,
  commandResultSchema,
  administrationSnapshotSchema,
  invitationResultSchema,
} from './responses';
