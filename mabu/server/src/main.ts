/**
 * Starts the Mábu API.
 *
 *   DATABASE_URL            PostgreSQL (migrations 001 + 002 applied). Without
 *                           it, MABU_DATA_FILE (default ./data/mabu.json) is used.
 *   PORT                    default 8787
 *   MABU_ALLOWED_ORIGINS    comma-separated web origins allowed to call the API
 *   MABU_DIRECT_INVENTORY   1 = take bookings against Mábu's own pacing (only
 *                           when every booking is entered in this system)
 *   EXPO_ACCESS_TOKEN       optional, Expo enhanced push security
 *   MABU_PUSH_ENABLED       false turns push delivery off
 *   MABU_DEV_LOG_EMAIL      1 = print emails (sign-in codes included) to the
 *                           log instead of sending. Development only.
 *   MABU_* feature flags    as in .env.example, without EXPO_PUBLIC_
 *
 * A production email provider plugs in as an `EmailSender` (server/src/auth.ts).
 */
import http from 'node:http';
import path from 'node:path';
import { flagsFromEnv } from '../../src/domain/flags';
import { createServer } from './app';
import type { EmailSender } from './auth';
import { FileStore, SqlStore, type ServerStore } from './store';

async function openStore(): Promise<ServerStore> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const store = new SqlStore(client);
    store.close = () => client.end();
    return store;
  }
  const file = process.env.MABU_DATA_FILE ?? path.resolve('data/mabu.json');
  console.warn(`[mabu] no DATABASE_URL: keeping data in ${file}`);
  return new FileStore(file);
}

function emailSender(): EmailSender | null {
  if (process.env.MABU_DEV_LOG_EMAIL === '1') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MABU_DEV_LOG_EMAIL must not be set in production: it logs sign-in codes.');
    }
    return {
      async send(to, subject, text) {
        console.log(`[email → ${to}] ${subject}\n${text}\n`);
      },
    };
  }
  return null;
}

async function main() {
  const store = await openStore();
  const flags = flagsFromEnv(process.env);
  const email = emailSender();
  if (!email) console.warn('[mabu] no email sender: sign-in and email notifications will refuse');
  const server = await createServer({
    store,
    flags,
    email,
    push:
      process.env.MABU_PUSH_ENABLED === 'false'
        ? undefined
        : { fetch, accessToken: process.env.EXPO_ACCESS_TOKEN },
    directInventory: process.env.MABU_DIRECT_INVENTORY === '1',
    allowedOrigins: (process.env.MABU_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  });

  // Reminders, expiry and retries (§31, §36, §42): every minute.
  const timer = setInterval(() => {
    server.runJobs().catch((e) => console.error('[jobs]', e));
  }, 60_000);

  const port = Number(process.env.PORT ?? 8787);
  const httpServer = http.createServer(server.handle);
  httpServer.listen(port, () => console.log(`[mabu] API listening on :${port}`));

  const stop = () => {
    clearInterval(timer);
    httpServer.close(() => void store.close?.().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
