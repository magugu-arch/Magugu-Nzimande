import { z } from 'zod';
import type { Failure, FailureCode } from './types';

/** One readable sentence per problem, without repeats. */
export function issuesToMessage(error: z.ZodError): string {
  const messages = new Set<string>();
  for (const issue of error.issues) messages.add(issue.message);
  return [...messages].join(' ');
}

export function fail(code: FailureCode, message: string): Failure {
  return { ok: false, code, message };
}

/** Required single-line text with a length limit. */
export function requiredText(label: string, max: number) {
  return z
    .string(`Add ${label}.`)
    .trim()
    .min(1, `Add ${label}.`)
    .max(max, `Keep ${label} to ${max} characters or fewer.`);
}

/** Optional text: missing and blank both become an empty string. */
export function optionalText(label: string, max: number) {
  return z.string().trim().max(max, `Keep ${label} to ${max} characters or fewer.`).default('');
}

/** An ISO 8601 instant that `Date` can read. */
export function isoInstant(message: string) {
  return z
    .string(message)
    .min(1, message)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), message);
}
