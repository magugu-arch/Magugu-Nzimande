import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { repository } from '../db';
import { sendSafely } from '../email/providers';
import { contactNotificationStudio, newsletterWelcome } from '../email/templates';
import { sanitizeText } from '../security';

export async function submitContact(input: { name: string; email: string; phone: string; subject: string; message: string }) {
  const msg = {
    name: sanitizeText(input.name),
    email: input.email,
    phone: sanitizeText(input.phone),
    subject: sanitizeText(input.subject),
    message: sanitizeText(input.message),
  };
  // Stored first: if email is down, the enquiry is still on record.
  await repository().addContactMessage(msg);
  const { siteUrl, studioEmail } = config();
  await sendSafely([contactNotificationStudio(siteUrl, msg, studioEmail)]);
}

// Development fallback only: production refuses to run without NEWSLETTER_SECRET.
const devSecret = randomBytes(32).toString('hex');

function newsletterSecret(): string {
  const c = config();
  if (c.newsletterSecret) return c.newsletterSecret;
  if (c.isProduction) throw new Error('NEWSLETTER_SECRET must be set in production.');
  return devSecret;
}

/** A signed token so an unsubscribe link only works for the address it was sent to. */
export function unsubscribeToken(email: string): string {
  return createHmac('sha256', newsletterSecret()).update(`unsubscribe:${email.toLowerCase()}`).digest('base64url');
}

export function unsubscribeUrl(email: string): string {
  return `${config().siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email)}`;
}

export async function subscribe(email: string, consent: boolean) {
  const { created } = await repository().addSubscriber(email, consent);
  // Only welcome someone once, however many times they submit.
  if (created) await sendSafely([newsletterWelcome(config().siteUrl, email, unsubscribeUrl(email))]);
}

export async function unsubscribe(email: string, token: string): Promise<boolean> {
  const given = Buffer.from(token);
  const expected = Buffer.from(unsubscribeToken(email));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  await repository().unsubscribe(email.toLowerCase());
  return true;
}
