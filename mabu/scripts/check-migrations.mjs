/**
 * Runs server/migrations/*.sql against a real PostgreSQL (PGlite: Postgres
 * compiled to WASM, no server needed), then tries to break each invariant
 * the schema promises and fails if any attempt succeeds.
 *
 *   npm run db:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { root } from './lib/web.mjs';

const dir = path.join(root, 'server/migrations');
const db = new PGlite({ extensions: { citext } });

for (const file of fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  console.log(`✓ applied ${file}`);
}

const tables = (
  await db.query(
    `select table_name from information_schema.tables where table_schema = 'public' order by 1`,
  )
).rows;
console.log(`  ${tables.length} tables`);

let failures = 0;
async function mustFail(label, sql) {
  try {
    await db.exec(sql);
    console.log(`✗ ${label}: was accepted`);
    failures += 1;
  } catch (error) {
    console.log(`✓ ${label}: refused (${String(error.message).split('\n')[0].slice(0, 70)})`);
  }
}
async function mustPass(label, sql) {
  try {
    await db.exec(sql);
    console.log(`✓ ${label}`);
  } catch (error) {
    console.log(`✗ ${label}: ${error.message}`);
    failures += 1;
  }
}

await mustPass(
  'seed a tier, an account and a guest',
  `insert into reward_tier (id, name, min_lifetime_points, "order") values ('member', 'Member', 0, 1);
   insert into guest (id, email) values ('g1', 'Lerato@Example.com');
   insert into reward_account (id, guest_id, tier_id) values ('a1', 'g1', 'member');`,
);
await mustFail(
  'duplicate email, differently cased',
  `insert into guest (id, email) values ('g2', 'lerato@example.com')`,
);
await mustFail(
  'negative rewards balance',
  `update reward_account set balance_points = -1 where id = 'a1'`,
);
await mustPass(
  'an earn line',
  `insert into reward_transaction (id, account_id, type, points, reference_type, reference_id, idempotency_key, description, actor_id, remaining_points)
   values ('t1', 'a1', 'earn', 250, 'reservation', 'r1', 'rule:visit:reservation:r1', 'Visit', 'system', 250)`,
);
await mustFail(
  'the same visit earning twice',
  `insert into reward_transaction (id, account_id, type, points, reference_type, reference_id, idempotency_key, description, actor_id)
   values ('t2', 'a1', 'earn', 250, 'reservation', 'r1', 'rule:visit:reservation:r1', 'Visit', 'system')`,
);
await mustPass(
  'a reversal',
  `insert into reward_transaction (id, account_id, type, points, reference_type, reference_id, idempotency_key, description, actor_id, reverses_transaction_id)
   values ('t3', 'a1', 'reverse', -250, 'admin', 't1', 'reverse:t1', 'Oops', 'admin', 't1')`,
);
await mustFail(
  'reversing the same line twice',
  `insert into reward_transaction (id, account_id, type, points, reference_type, reference_id, idempotency_key, description, actor_id, reverses_transaction_id)
   values ('t4', 'a1', 'reverse', -250, 'admin', 't1', 'reverse:t1:again', 'Oops', 'admin', 't1')`,
);

await mustPass(
  'a live notification',
  `insert into notification_message (id, guest_id, category, template_key, channels, dedupe_key, status)
   values ('n1', 'g1', 'booking', 'booking.reminder', '{push}', 'reservation:r1:reminder:24h', 'scheduled')`,
);
await mustFail(
  'a second live notification on the same dedupe key',
  `insert into notification_message (id, guest_id, category, template_key, channels, dedupe_key, status)
   values ('n2', 'g1', 'booking', 'booking.reminder', '{push}', 'reservation:r1:reminder:24h', 'queued')`,
);
await mustPass(
  're-issuing a cancelled reminder on its key',
  `update notification_message set status = 'cancelled' where id = 'n1';
   insert into notification_message (id, guest_id, category, template_key, channels, dedupe_key, status)
   values ('n3', 'g1', 'booking', 'booking.reminder', '{push}', 'reservation:r1:reminder:24h', 'scheduled')`,
);
await mustPass(
  'one delivery row',
  `insert into notification_delivery (id, notification_id, channel, status) values ('n3:push', 'n3', 'push', 'pending')`,
);
await mustFail(
  'a second delivery row for the same channel',
  `insert into notification_delivery (id, notification_id, channel, status) values ('n3:push:b', 'n3', 'push', 'pending')`,
);

await mustPass(
  'a webhook',
  `insert into provider_webhook_event (id, provider, provider_event_id, type, payload) values ('dineplan:e1', 'dineplan', 'e1', 'x', '{}')`,
);
await mustFail(
  'the same webhook again',
  `insert into provider_webhook_event (id, provider, provider_event_id, type, payload) values ('dineplan:e1:b', 'dineplan', 'e1', 'x', '{}')`,
);

await mustFail(
  'a voucher overdrawn',
  `insert into voucher (id, code, amount_cents, remaining_cents, status, purchaser_guest_id, recipient_name, recipient_email, for_self, delivery)
   values ('v1', 'MABU-AAAA-BBBB', 100000, 100001, 'active', 'g1', 'N', 'n@example.com', false, 'email')`,
);
await mustFail(
  `a voucher policy shorter than the CPA's three years`,
  `insert into voucher_policy (id, document, expiry_months) values ('voucher-policy', '{}', 12)`,
);
await mustFail(
  'an event overbooked',
  `insert into experience (id, title, kind, starts_at, ends_at, room, capacity, seats_booked, max_seats_per_booking, description, hero_photo)
   values ('e1', 'X', 'wine-pairing', now(), now() + interval '1 hour', 'Room', 10, 11, 4, 'd', 'p')`,
);
await mustFail(
  'a reservation that is all children',
  `insert into reservation (id, reference, provider, status, venue_id, slot_id, starts_at, party_size, children, guest_id, guest_name, guest_email, guest_phone)
   values ('r1', 'MB-1', 'mabu-direct', 'confirmed', 'v', 's', now(), 2, 2, 'g1', 'n', 'e', 'p')`,
);
await mustFail(
  'an idempotency key reused in the same scope',
  `insert into idempotency_record (id, scope, key, fingerprint) values ('a', 's', 'k', 'f');
   insert into idempotency_record (id, scope, key, fingerprint) values ('b', 's', 'k', 'f')`,
);

await db.close();
console.log(
  `\n${failures ? `${failures} invariant(s) not enforced` : 'Schema applies cleanly and enforces every invariant checked'}.`,
);
process.exit(failures ? 1 : 0);
