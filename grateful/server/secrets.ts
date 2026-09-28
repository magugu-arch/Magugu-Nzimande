/**
 * Fresh values for the secrets the site makes itself (not ones a provider
 * issues). `npm run gen:secrets` prints them; they go straight into Vercel.
 * No imports beyond node: node runs this file directly.
 */
import { randomBytes } from 'node:crypto';

const secret = () => randomBytes(32).toString('base64url');

export function newSecrets(): { ADMIN_TOKEN: string; NEWSLETTER_SECRET: string; CRON_SECRET: string } {
  return { ADMIN_TOKEN: secret(), NEWSLETTER_SECRET: secret(), CRON_SECRET: secret() };
}
