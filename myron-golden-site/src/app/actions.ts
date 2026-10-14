'use server';

import { headers } from 'next/headers';
import { deliver } from '@/lib/delivery';
import { createRateLimiter } from '@/lib/rate-limit';
import {
  contactSchema,
  type FieldErrors,
  fieldErrors,
  formDataToObject,
  newsletterSchema,
  speakingEnquirySchema,
} from '@/lib/validation';

/**
 * Form handlers. The server is the gate: everything is validated here
 * whatever the browser did. A success state is returned only when delivery
 * actually succeeded (or, in preview, when it was logged — and the message
 * says so).
 */

export type FormState =
  | { status: 'idle' }
  | {
      status: 'error';
      message: string;
      errors: FieldErrors;
      values: Record<string, string | string[]>;
    }
  | { status: 'success'; message: string; preview: boolean };

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

async function clientKey(kind: string): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  return `${kind}:${ip}`;
}

function echo(raw: Record<string, unknown>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'website') continue;
    if (typeof v === 'string') out[k] = v.slice(0, 4000);
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
  }
  return out;
}

const FAILED =
  'We could not send this just now, and nothing has been submitted. Please try again in a few minutes.';
const LIMITED =
  'That is a lot of messages in a short time, so this one was not sent. Please wait a few minutes and try again.';

async function handle<T extends Record<string, unknown>>(options: {
  kind: 'speaking' | 'contact' | 'newsletter';
  formData: FormData;
  schema: {
    safeParse: (
      v: unknown,
    ) => { success: true; data: T } | { success: false; error: Parameters<typeof fieldErrors>[0] };
  };
  arrayKeys?: string[];
  sourcePage: string;
  success: string;
  invalid: string;
}): Promise<FormState> {
  const raw = formDataToObject(options.formData, options.arrayKeys);

  // Bots fill the hidden field. Accept quietly; deliver nothing.
  if (typeof raw.website === 'string' && raw.website.trim() !== '') {
    return { status: 'success', message: options.success, preview: false };
  }

  const parsed = options.schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'error',
      message: options.invalid,
      errors: fieldErrors(parsed.error),
      values: echo(raw),
    };
  }

  if (!limiter.check(await clientKey(options.kind))) {
    return { status: 'error', message: LIMITED, errors: {}, values: echo(raw) };
  }

  // Forms on several pages say where they were sent from; only same-site paths are kept.
  const sourcePage =
    typeof raw.sourcePage === 'string' && /^\/[\w\-/]*$/.test(raw.sourcePage)
      ? raw.sourcePage.slice(0, 200)
      : options.sourcePage;

  // Consent is recorded as a timestamp below rather than passed on as a raw checkbox value.
  const payload: Record<string, unknown> = { ...parsed.data };
  delete payload.consent;
  const result = await deliver(
    options.kind,
    { ...payload, consentGivenAt: new Date().toISOString() },
    { sourcePage },
  );

  if (!result.ok) {
    return { status: 'error', message: FAILED, errors: {}, values: echo(raw) };
  }
  return {
    status: 'success',
    message: options.success,
    preview: result.channel === 'preview-log',
  };
}

export async function submitSpeakingEnquiry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handle({
    kind: 'speaking',
    formData,
    schema: speakingEnquirySchema,
    sourcePage: '/speaking',
    invalid: 'Some details need attention before this can be sent.',
    success:
      'Your enquiry has been submitted. This is not a booking: the team will review the details, check availability and reply by email.',
  });
}

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  return handle({
    kind: 'contact',
    formData,
    schema: contactSchema,
    sourcePage: '/contact',
    invalid: 'Some details need attention before this can be sent.',
    success: 'Your message has been sent. The team will reply by email.',
  });
}

export async function subscribeNewsletter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handle({
    kind: 'newsletter',
    formData,
    schema: newsletterSchema,
    arrayKeys: ['topics'],
    sourcePage: '/',
    invalid: 'Check the highlighted details.',
    success: 'You are on the list. Look out for a confirmation email to finish signing up.',
  });
}
