#!/usr/bin/env node
/**
 * npm run gen:secrets
 * Prints fresh random values for the three secrets the site makes itself.
 * Paste each straight into Vercel (Settings → Environment Variables). Never
 * send them by email or chat, and never commit them.
 */
import { newSecrets } from '../server/secrets.ts';

const s = newSecrets();
console.log(`
Paste these into Vercel → Settings → Environment Variables, then redeploy.
Keep them private: don't email, message or commit them.

  ADMIN_TOKEN=${s.ADMIN_TOKEN}
  NEWSLETTER_SECRET=${s.NEWSLETTER_SECRET}
  CRON_SECRET=${s.CRON_SECRET}

ADMIN_TOKEN is the studio key that opens the dashboard. Keep a copy in the
studio's password manager: it can't be recovered, only replaced.
`);
