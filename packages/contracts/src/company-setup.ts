import { z } from 'zod';
import { identifierSchema } from './schemas';

const name = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value.trim().length > 0);
export const companySetupInputSchema = z
  .object({
    name,
    plantName: name,
    warehouseName: name,
    currency: z.string().regex(/^[A-Z]{3}$/),
    timezone: z.string().min(1).max(100),
  })
  .strict();
export const companySetupRequestSchema = z
  .object({
    contractVersion: z.literal(1),
    actorId: identifierSchema,
    requestKey: identifierSchema,
    input: companySetupInputSchema,
  })
  .strict();
export type CompanySetupInput = z.infer<typeof companySetupInputSchema>;
export type CompanySetupRequest = z.infer<typeof companySetupRequestSchema>;
