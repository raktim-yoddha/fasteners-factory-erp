import { z } from 'zod';
import {
  authoritySchema,
  decimalSchema,
  entityKindSchema,
  errorCodes,
  fieldsSchema,
  identifierSchema,
} from './schemas';
import type { CommandResult, Snapshot, Workspace } from './index';

const revision = z.string().regex(/^\d+$/);
const timestamp = z.string().min(10).max(80);
const operationalObligationSchema = z
  .object({
    id: identifierSchema,
    code: z.string(),
    itemId: identifierSchema,
    quantity: decimalSchema,
    state: z.string(),
  })
  .strict();
export const workspaceSchema = z
  .object({
    id: identifierSchema,
    name: z.string(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    timezone: z.string(),
    createdAt: timestamp,
  })
  .strict() satisfies z.ZodType<Workspace>;
export const commandResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      value: z.object({ id: identifierSchema, message: z.string() }).strict(),
      committedAt: timestamp,
      authority: authoritySchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum(errorCodes),
          message: z.string(),
          retryable: z.boolean(),
          correlationId: identifierSchema,
        })
        .strict(),
    })
    .strict(),
]) satisfies z.ZodType<CommandResult>;
export const snapshotSchema = z
  .object({
    operationalOrders: z.array(operationalObligationSchema).max(200).optional(),
    operationalPurchaseOrders: z.array(operationalObligationSchema).max(200).optional(),
    workspace: workspaceSchema,
    records: z
      .array(
        z
          .object({
            id: identifierSchema,
            kind: entityKindSchema,
            code: z.string(),
            name: z.string(),
            state: z.string(),
            revision,
            fields: fieldsSchema,
            createdAt: timestamp,
          })
          .strict(),
      )
      .max(200),
    lots: z
      .array(
        z
          .object({
            id: identifierSchema,
            code: z.string(),
            itemId: identifierSchema,
            itemName: z.string(),
            unit: z.string(),
            location: z.string(),
            qcState: z.enum(['held', 'released']),
            onHand: decimalSchema,
            reserved: decimalSchema,
            available: decimalSchema,
            wip: decimalSchema,
            vendor: decimalSchema,
            revision,
          })
          .strict(),
      )
      .max(200),
    reservations: z
      .array(
        z
          .object({
            id: identifierSchema,
            lotId: identifierSchema,
            orderId: identifierSchema,
            quantity: decimalSchema,
            state: z.string(),
          })
          .strict(),
      )
      .max(200),
    packages: z
      .array(
        z
          .object({
            id: identifierSchema,
            reservationId: identifierSchema,
            code: z.string(),
            lotId: identifierSchema,
            orderId: identifierSchema,
            quantity: decimalSchema,
            state: z.string(),
          })
          .strict(),
      )
      .max(200),
    shipments: z
      .array(
        z
          .object({
            id: identifierSchema,
            code: z.string(),
            lotId: identifierSchema,
            orderId: identifierSchema,
            quantity: decimalSchema,
            carrier: z.string(),
            createdAt: timestamp,
          })
          .strict(),
      )
      .max(200),
    audit: z
      .array(
        z
          .object({
            id: identifierSchema,
            command: z.string(),
            entityId: identifierSchema,
            actor: z.string(),
            reason: z.string(),
            createdAt: timestamp,
          })
          .strict(),
      )
      .max(100),
    asOf: timestamp,
    plantId: identifierSchema.optional(),
    plants: z
      .array(z.object({ id: identifierSchema, name: z.string() }).strict())
      .max(1000)
      .optional(),
    capabilities: z.array(z.string()).max(100).optional(),
  })
  .strict() satisfies z.ZodType<Snapshot>;

export const administrationSnapshotSchema = z
  .object({
    actorId: identifierSchema,
    members: z.array(
      z
        .object({
          id: identifierSchema,
          email: z.string(),
          active: z.boolean(),
          allPlants: z.boolean(),
          roles: z.array(z.string()),
          plantIds: z.array(identifierSchema),
          grants: z.array(z.string()),
        })
        .strict(),
    ),
    plants: z.array(z.object({ id: identifierSchema, name: z.string() }).strict()),
    roles: z.array(
      z
        .object({ name: z.string(), delegable: z.boolean(), permissions: z.array(z.string()) })
        .strict(),
    ),
    settings: z
      .object({
        independentReview: z.boolean(),
        requireMfa: z.boolean(),
        state: z.enum(['active', 'archived']),
      })
      .strict(),
  })
  .strict();
export const invitationResultSchema = z
  .object({ id: identifierSchema, token: z.string().min(20).max(200) })
  .strict();
