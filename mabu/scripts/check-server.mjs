/**
 * End-to-end check of the API server on real PostgreSQL (PGlite) over real
 * HTTP: migrations applied, sign-in by emailed code, a booking, a restart
 * that must keep it, and the refusals that matter.
 *
 *   npm run server:check
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { root } from './lib/web.mjs';

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mabu-server-')), 'harness.mjs');
await build({
  stdin: {
    contents: `export { createServer } from './server/src/app';
export { SqlStore } from './server/src/store';
export { flagsFromEnv } from './src/domain/flags';`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});
const { createServer, SqlStore, flagsFromEnv } = await import(pathToFileURL(out).href);

const db = new PGlite({ extensions: { citext } });
const dir = path.join(root, 'server/migrations');
for (const f of fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort())
  await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  ${detail}`}`);
  if (!ok) failures += 1;
};

const mail = [];
async function start() {
  const server = await createServer({
    store: new SqlStore(db),
    flags: flagsFromEnv({}),
    email: { send: async (to, subject, text) => void mail.push({ to, subject, text }) },
    directInventory: true,
    log: () => undefined,
  });
  const httpServer = http.createServer(server.handle);
  await new Promise((r) => httpServer.listen(0, r));
  const base = `http://127.0.0.1:${httpServer.address().port}`;
  const rpc = async (name, body = {}, token, headers = {}) => {
    const res = await fetch(`${base}/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  return { server, base, rpc, stop: () => new Promise((r) => httpServer.close(r)) };
}

let api = await start();
check('health', (await (await fetch(`${api.base}/health`)).json()).ok === true);

const email = 'guest@example.com';
const req = await api.rpc('auth.requestCode', { email });
check('code requested, not returned', req.status === 200 && !('mockCode' in req.body));
const code = /(\d{6})/.exec(mail.at(-1)?.text ?? '')?.[1];
check('code emailed', !!code);
const wrong = await api.rpc('auth.verifyCode', {
  email,
  code: code === '000000' ? '111111' : '000000',
});
check('wrong code refused', wrong.status === 400);
const ok = await api.rpc('auth.verifyCode', { email, code, name: 'Guest' });
check('right code signs in', ok.status === 200 && typeof ok.body.token === 'string');
const token = ok.body.token;

check('signed-out call is 401', (await api.rpc('booking.mine')).status === 401);
check('guest id is not a token', (await api.rpc('me.get', {}, ok.body.guest.id)).status === 401);

const menu = await api.rpc('content.menu');
check('menu served', menu.status === 200 && menu.body.dishes.length > 20);

const date = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
const slots = await api.rpc('booking.search', { date, partySize: 2 });
const slot = Array.isArray(slots.body) ? slots.body.find((s) => s.available) : undefined;
check('availability from direct inventory', !!slot, JSON.stringify(slots.body).slice(0, 200));
let bookingId;
if (slot) {
  const booking = await api.rpc(
    'booking.create',
    {
      slotId: slot.slotId,
      partySize: 2,
      guest: { name: 'Guest', email, phone: '082 555 0100' },
    },
    token,
    { 'Idempotency-Key': 'check-server-1' },
  );
  check('booking created', booking.status === 200, JSON.stringify(booking.body));
  bookingId = booking.body.id;
}

const rows = (await db.query(`select count(*)::int as n from server_row`)).rows[0].n;
check('rows written to PostgreSQL', rows > 50, String(rows));
const sessions = (await db.query(`select count(*)::int as n from server_session`)).rows[0].n;
check('session stored hashed', sessions === 1);
const leaked = (
  await db.query(`select count(*)::int as n from server_session where token_hash = $1`, [token])
).rows[0].n;
check('raw token never stored', leaked === 0);

await api.stop();
api = await start();
const mine = await api.rpc('booking.mine', {}, token);
check(
  'booking and session survive a restart',
  mine.status === 200 && JSON.stringify(mine.body).includes(bookingId ?? '∅'),
);
check(
  'mock-only tool hidden',
  (await api.rpc('admin.simulateFailure', { channel: 'push', count: 1 }, token)).status === 404,
);
await api.stop();

if (failures) {
  console.error(`\n${failures} server check(s) failed`);
  process.exit(1);
}
console.log('\nAPI server passes on PostgreSQL over HTTP.');
