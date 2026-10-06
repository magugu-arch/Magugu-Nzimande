/**
 * Create (or reset the password of) a management account.
 *
 *   npm run admin:create -- owner@example.com "Full Name" owner
 *   npm run admin:create -- manager@example.com "Full Name" manager
 *
 * Roles: owner (everything, including confirmation overrides), manager
 * (runs bookings), viewer (read-only). The password comes from ADMIN_PASSWORD,
 * or a strong one is generated and printed once.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { hashPassword } from '../src/lib/auth/password';
import type { AdminRole } from '../src/lib/booking/types';
import { FileStore } from '../src/lib/store/file-store';
import { PostgresStore } from '../src/lib/store/postgres-store';

const [emailArg, name = 'Management', roleArg = 'manager'] = process.argv.slice(2);
const roles: AdminRole[] = ['owner', 'manager', 'viewer'];
if (!emailArg || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailArg) || !roles.includes(roleArg as AdminRole)) {
  console.error('Usage: npm run admin:create -- <email> "<name>" <owner|manager|viewer>');
  process.exit(1);
}
const email = emailArg.toLowerCase();
const role = roleArg as AdminRole;
const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString('base64url');

const store = process.env.DATABASE_URL
  ? new PostgresStore(process.env.DATABASE_URL)
  : new FileStore(process.env.FILE_STORE_PATH ?? path.join(process.cwd(), '.data', 'store.json'));

const passwordHash = await hashPassword(password);
const existing = await store.findOne('admin_users', { email });
if (existing) {
  await store.update('admin_users', existing.id, { name, role, passwordHash });
  console.log(`Updated ${email} (${role}). Existing sessions are signed out.`);
} else {
  await store.insert('admin_users', { id: randomUUID(), email, name, role, passwordHash, createdAt: new Date().toISOString(), lastLoginAt: null });
  console.log(`Created ${email} (${role}) in the ${store.kind} store.`);
}
if (!process.env.ADMIN_PASSWORD) console.log(`Password (shown once): ${password}`);
if (store instanceof PostgresStore) await store.end();
