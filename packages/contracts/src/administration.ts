import { z } from 'zod';
import { identifierSchema } from './schemas';

const names = z
  .array(z.string().min(1).max(80))
  .max(100)
  .refine((values) => new Set(values).size === values.length);
const plants = z
  .array(identifierSchema)
  .max(1000)
  .refine((values) => new Set(values).size === values.length);
const roles = names.refine((values) => values.length > 0 && values.length <= 17);
export const memberAccessSchema = z
  .object({
    id: identifierSchema,
    email: z.string().max(320),
    active: z.boolean(),
    allPlants: z.boolean(),
    roles,
    plantIds: plants,
    grants: names,
  })
  .strict();
const access = { roles, plantIds: plants, allPlants: z.boolean() };
const name = z
  .string()
  .min(1)
  .max(120)
  .refine((value) => value.trim().length > 0);
export const administrationOperationSchema = z.discriminatedUnion('command', [
  z
    .object({
      command: z.literal('invite_member'),
      input: z.object({ email: z.email().max(320), ...access }).strict(),
    })
    .strict(),
  z.object({ command: z.literal('update_member_access'), input: memberAccessSchema }).strict(),
  z
    .object({
      command: z.literal('create_plant'),
      input: z.object({ name, warehouseName: name }).strict(),
    })
    .strict(),
]);
export const administrationRequestSchema = z
  .object({
    contractVersion: z.literal(1),
    actorId: identifierSchema,
    companyId: identifierSchema,
    requestKey: identifierSchema,
    operation: administrationOperationSchema,
  })
  .strict();
export const administrationResultSchema = z.discriminatedUnion('command', [
  z
    .object({
      command: z.literal('invite_member'),
      id: identifierSchema,
      token: z.string().min(20).max(200),
    })
    .strict(),
  z.object({ command: z.literal('create_plant'), id: identifierSchema }).strict(),
  z.object({ command: z.literal('update_member_access'), id: identifierSchema }).strict(),
]);
export type MemberAccess = z.infer<typeof memberAccessSchema>;
export type AdministrationOperation = z.infer<typeof administrationOperationSchema>;
export type AdministrationRequest = z.infer<typeof administrationRequestSchema>;
export type AdministrationResult = z.infer<typeof administrationResultSchema>;
