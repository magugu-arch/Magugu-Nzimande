import { z } from 'zod';
import { isoDateTime } from './provenance';

export const LOCALES = ['en-ZA', 'zu-ZA', 'st-ZA', 'xh-ZA'] as const;

export const profileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(2).max(40),
  email: z.email(),
  avatarPath: z.string().nullable(),
  locale: z.enum(LOCALES),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Profile = z.infer<typeof profileSchema>;

/**
 * Privacy choices. Everything that is not needed to run the service starts
 * off; the supporter opts in. Reviewed against POPIA by the club's privacy
 * team before launch.
 */
export const privacySettingsSchema = z.object({
  marketingEmail: z.boolean(),
  marketingSms: z.boolean(),
  productAnalytics: z.boolean(),
  personalisedContent: z.boolean(),
  /** Default for the "show my name" choice on new Fan Moments. */
  showNameOnFanMoments: z.boolean(),
});
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

export function defaultPrivacySettings(): PrivacySettings {
  return {
    marketingEmail: false,
    marketingSms: false,
    productAnalytics: false,
    personalisedContent: false,
    showNameOnFanMoments: false,
  };
}

export const PASSWORD_MIN = 10;

export const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'At least 2 characters').max(40, 'Up to 40 characters'),
  email: z.email('Enter a valid email address'),
  password: z
    .string()
    .min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`)
    .regex(/[A-Za-z]/, 'Include a letter')
    .regex(/[0-9]/, 'Include a number'),
  acceptedTerms: z.literal(true, 'Accept the terms and privacy notice to continue'),
  /** POPIA: direct marketing needs separate, explicit opt-in. */
  marketingOptIn: z.boolean(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: z.email('Enter a valid email address') });

/** Map a zod error to a { field: message } object for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
