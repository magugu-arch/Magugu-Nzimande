import { z } from 'zod';
import { provenanceSchema } from './provenance';

export const productSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(['kit', 'training', 'lifestyle', 'accessories', 'gifts']),
    imageKey: z.string().nullable(),
    /** Price text as published by the official store. Null in demo. */
    priceText: z.string().nullable(),
    /** Link into the official store. Null until the store is confirmed. */
    productUrl: z.url().nullable(),
    provenance: provenanceSchema,
  })
  .refine((p) => p.provenance.state !== 'demo' || (p.priceText === null && p.productUrl === null), {
    message: 'Demo products carry no prices and no store links.',
  });
export type Product = z.infer<typeof productSchema>;
