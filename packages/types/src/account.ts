import { z } from 'zod';
import { CustomerSchema } from './order';

/**
 * Customer accounts.
 *
 * Until now an order carried a name, an email and a mobile typed in at
 * checkout, and nothing tied two orders by the same person together. That is
 * fine for a demo and useless for reordering, saved addresses or points that
 * survive a browser.
 *
 * Nothing here holds a password. The stored shape carries a hash and the
 * parameters it was made with, and there is no schema in this file with a
 * plaintext password field on it that could be returned by accident — the
 * credential schemas are inputs only, and `AccountSchema` is what leaves the
 * server.
 */

/** What the customer sees about themselves, and what any endpoint may return. */
export const AccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  mobile: z.string().min(1),
  createdAt: z.string().min(1),
  /** Points live on the account rather than on a device. */
  points: z.number().int().nonnegative(),
});
export type Account = z.infer<typeof AccountSchema>;

export const SavedAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().min(1).max(200),
  suburb: z.string().trim().min(1).max(80),
  note: z.string().trim().max(140).default(''),
});
export type SavedAddress = z.infer<typeof SavedAddressSchema>;

export const NewAddressSchema = SavedAddressSchema.omit({ id: true });
export type NewAddress = z.infer<typeof NewAddressSchema>;

/**
 * A password long enough to be worth hashing.
 *
 * Length only. Composition rules — a digit, a symbol, a capital — push people
 * towards Password1! and are not what makes a passphrase hard to guess.
 */
export const PasswordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'That is longer than we can store');

export const RegisterRequestSchema = CustomerSchema.extend({
  password: PasswordSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const SignInRequestSchema = z.object({
  email: z.email(),
  // Not PasswordSchema: an old account may have a shorter password than the
  // rule we enforce today, and refusing to *check* it would lock them out.
  password: z.string().min(1),
});
export type SignInRequest = z.infer<typeof SignInRequestSchema>;
