import { serviceSeed } from '../../src/data/services';
import { addDays, todayInSast } from '../../shared/format';
import type { Service } from '../../shared/types';
import { setRepository } from '../db';
import { createMemoryRepository } from '../db/memory';
import type { Repository } from '../db/types';
import { setEmailProvider } from '../email/providers';
import type { EmailMessage } from '../email/types';
import { setPaymentProvider } from '../payments';
import { createMockProvider } from '../payments/mock';
import { resetRateLimits } from '../security';

/**
 * Shared test fixtures. Every suite starts from the same known studio: the
 * four real services (one given a test price so the payment path can run),
 * one open day a week from now, a sample client, and an email outbox that
 * records instead of sending.
 *
 * Test prices live here and only here — never in seed data the site shows.
 */

export const TEST_DATE = addDays(todayInSast(), 7);

/** The catalogue exactly as seeded: every price null ("Quote required"). */
export const realServices: Service[] = serviceSeed;

export const pricedServices: Service[] = serviceSeed.map((s) =>
  s.id === 'custom-design' ? { ...s, priceCents: 200_000, depositCents: 50_000 } : s.id === 'special-occasion' ? { ...s, priceCents: 400_000, depositCents: null } : s,
);

export const client = {
  clientName: 'Thandi Mokoena',
  email: 'thandi@example.com',
  phone: '+27 82 000 0000',
  notes: '',
};

export type Studio = { repo: Repository; outbox: EmailMessage[] };

/** Install a fresh in-memory studio and return it. Call in beforeEach; pair with resetStudio in afterEach. */
export function setupStudio(opts: { services?: Service[]; hours?: { startTime: string; endTime: string }; date?: string } = {}): Studio {
  process.env.MIN_NOTICE_HOURS = '0';
  const date = opts.date ?? TEST_DATE;
  const repo = createMemoryRepository({
    services: opts.services ?? pricedServices,
    availability: [{ date, ...(opts.hours ?? { startTime: '09:00', endTime: '17:00' }) }],
  });
  const outbox: EmailMessage[] = [];
  setRepository(repo);
  setPaymentProvider(createMockProvider());
  setEmailProvider({ name: 'outbox', send: async (m) => void outbox.push(m) });
  resetRateLimits();
  return { repo, outbox };
}

export function resetStudio() {
  setRepository(null);
  setPaymentProvider(null);
  setEmailProvider(null);
  delete process.env.ADMIN_TOKEN;
}

export const ADMIN_TOKEN = 'studio-test-token-0123456789';

/** Turn on the admin API for this test and return the header that unlocks it. */
export function adminAuth(): Record<string, string> {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  return { authorization: `Bearer ${ADMIN_TOKEN}` };
}

/** Three sample clients booked into TEST_DATE, for tests that need a filled diary. */
export const sampleClients = [
  { clientName: 'Lerato Dlamini', email: 'lerato@example.com', phone: '082 111 2222', notes: 'Matric dance dress, emerald.' },
  { clientName: 'Nomsa Khumalo', email: 'nomsa@example.com', phone: '083 333 4444', notes: '' },
  { clientName: 'Aisha Patel', email: 'aisha@example.com', phone: '084 555 6666', notes: 'Taking in a blazer.' },
];
