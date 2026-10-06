/**
 * Demo data for previews, training and screenshots: a booking at every stage
 * of the journey, sample public listings, community signups and proposals,
 * and one account per role. Everything goes through the real booking service,
 * so every record is one the state machine could have produced.
 *
 *   npm run seed:demo                 file store (.data/store.json), or DATABASE_URL
 *   npm run seed:demo -- --reset      file store only: start from empty
 *   npm run seed:demo -- --force      allow a non-local database
 *
 * All of it is fictional and labelled as such (example.com addresses,
 * "Sample" listings). It must never reach a production database: the script
 * refuses NODE_ENV=production and any non-local DATABASE_URL without --force.
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { hashPassword } from '../src/lib/auth/password';
import { addDays, todayIso } from '../src/lib/booking/dates';
import { DEFAULT_CANCELLATION_TERMS } from '../src/lib/booking/quote';
import type { BookingRequestData } from '../src/lib/booking/schemas';
import {
  acceptQuote,
  adminAddNote,
  adminChangeStatus,
  adminConfirmBooking,
  adminHoldDate,
  adminRecordManualPayment,
  adminSaveQuote,
  adminSendQuote,
  adminSetAvailability,
  getPortal,
  requestQuoteChanges,
  signContract,
  submitBookingRequest,
  type Actor,
} from '../src/lib/booking/service';
import type { AdminRole, BookingStatus } from '../src/lib/booking/types';
import { CONSENT_TEXT } from '../src/lib/consent';
import { newId } from '../src/lib/security/crypto';
import { getStore } from '../src/lib/store';

const args = new Set(process.argv.slice(2));
const today = todayIso();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}
const db = process.env.DATABASE_URL;
if (db && !/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(db) && !args.has('--force')) {
  console.error('DATABASE_URL is not local. Demo data must not reach a real database; pass --force only for a disposable staging copy.');
  process.exit(1);
}
if (args.has('--reset')) {
  if (db) {
    console.error('--reset only clears the file store. Use a fresh database instead.');
    process.exit(1);
  }
  rmSync(process.env.FILE_STORE_PATH ?? path.join(process.cwd(), '.data', 'store.json'), { force: true });
}

const store = getStore();
if ((await store.count('bookings')) > 0 && !args.has('--force')) {
  console.error('The store already has bookings. Run with --reset (file store) or point at an empty database.');
  process.exit(1);
}

// ── Accounts ──
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-password-change-me';
const people: { email: string; name: string; role: AdminRole }[] = [
  { email: 'owner@example.com', name: 'Demo Owner', role: 'owner' },
  { email: 'manager@example.com', name: 'Demo Booking Manager', role: 'manager' },
  { email: 'viewer@example.com', name: 'Demo Viewer', role: 'viewer' },
];
const ids: Record<AdminRole, string> = { owner: '', manager: '', viewer: '' };
for (const p of people) {
  const existing = await store.findOne('admin_users', { email: p.email });
  ids[p.role] =
    existing?.id ??
    (
      await store.insert('admin_users', {
        id: newId(),
        ...p,
        passwordHash: await hashPassword(DEMO_PASSWORD),
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      })
    ).id;
}
const owner: Actor = { id: ids.owner, name: 'Demo Owner', role: 'owner' };
const manager: Actor = { id: ids.manager, name: 'Demo Booking Manager', role: 'manager' };

// ── Bookings, one per stage ──
type Spec = { name: string; org: string | null; city: string; venue: string; days: number; type: BookingRequestData['eventType']; format: BookingRequestData['performanceFormat']; budget: BookingRequestData['budgetRange']; crowd: number; fee: number; target: BookingStatus | 'CHANGES' | 'SIGNED' };

const specs: Spec[] = [
  { name: 'Ayanda Mokoena', org: 'Sample Holdings (demo)', city: 'Johannesburg', venue: 'Sample Convention Centre', days: 41, type: 'corporate', format: 'headline', budget: '300k-600k', crowd: 1800, fee: 0, target: 'NEW' },
  { name: 'Pieter van Wyk', org: null, city: 'Stellenbosch', venue: 'Sample Wine Estate', days: 96, type: 'wedding', format: 'dj-set', budget: '150k-300k', crowd: 220, fee: 0, target: 'NEW' },
  { name: 'Naledi Khumalo', org: 'Demo Festival Co.', city: 'Durban', venue: 'Sample Beachfront Stage', days: 74, type: 'festival', format: 'live-band', budget: 'over-600k', crowd: 12000, fee: 0, target: 'IN_REVIEW' },
  { name: 'Sipho Ndlovu', org: 'Demo University SRC', city: 'Pretoria', venue: 'Sample Campus Amphitheatre', days: 58, type: 'private', format: 'headline', budget: '150k-300k', crowd: 3500, fee: 0, target: 'ON_HOLD' },
  { name: 'Fatima Patel', org: 'Sample Bank (demo)', city: 'Cape Town', venue: 'Sample Waterfront Ballroom', days: 112, type: 'corporate', format: 'headline', budget: '300k-600k', crowd: 900, fee: 32_000_000, target: 'QUOTE_SENT' },
  { name: 'Kgomotso Molefe', org: 'Demo Lifestyle Brand', city: 'Johannesburg', venue: 'Sample Rooftop', days: 67, type: 'brand', format: 'dj-set', budget: '150k-300k', crowd: 400, fee: 18_500_000, target: 'CHANGES' },
  { name: 'Lindiwe Zulu', org: 'Demo Hospitality Group', city: 'Gqeberha', venue: 'Sample Hotel Pavilion', days: 88, type: 'corporate', format: 'live-band', budget: '300k-600k', crowd: 1100, fee: 38_000_000, target: 'AWAITING_DEPOSIT' },
  { name: 'Johan Botha', org: 'Sample Agency (demo)', city: 'Bloemfontein', venue: 'Sample Showgrounds', days: 125, type: 'festival', format: 'headline', budget: 'over-600k', crowd: 8000, fee: 45_000_000, target: 'SIGNED' },
  { name: 'Zanele Mthembu', org: 'Demo Telecoms', city: 'Sandton', venue: 'Sample Arena', days: 33, type: 'corporate', format: 'headline', budget: 'over-600k', crowd: 2500, fee: 52_000_000, target: 'CONFIRMED' },
  { name: 'Michael Naidoo', org: 'Sample Charity Gala (demo)', city: 'Umhlanga', venue: 'Sample Hotel Ballroom', days: 21, type: 'private', format: 'dj-set', budget: '150k-300k', crowd: 350, fee: 21_000_000, target: 'COMPLETED' },
  { name: 'Busisiwe Dube', org: null, city: 'Polokwane', venue: 'Sample Garden Venue', days: 150, type: 'wedding', format: 'headline', budget: 'under-150k', crowd: 180, fee: 0, target: 'CANCELLED' },
];

const created: string[] = [];
for (const [i, s] of specs.entries()) {
  const date = addDays(today, s.days);
  const { reference, token } = await submitBookingRequest(
    {
      eventDate: date,
      startTime: ['19:00', '20:30', '21:00', '18:00'][i % 4]!,
      endTime: undefined,
      eventType: s.type,
      performanceFormat: s.format,
      expectedAttendance: s.crowd,
      budgetRange: s.budget,
      venue: s.venue,
      city: s.city,
      country: 'South Africa',
      travelRequired: !['Johannesburg', 'Sandton', 'Pretoria'].includes(s.city),
      travelNotes: !['Johannesburg', 'Sandton', 'Pretoria'].includes(s.city) ? 'Flights for artist and crew from Johannesburg' : null,
      accommodationRequired: s.days > 60,
      accommodationNotes: s.days > 60 ? 'Two nights, five rooms' : null,
      productionNotes: i % 3 === 0 ? 'House PA and lighting supplied; artist to send rider.' : null,
      additionalInfo: 'Demo booking created by npm run seed:demo.',
      fullName: s.name,
      organisation: s.org,
      email: `demo+${i + 1}@example.com`,
      phone: `+27 82 555 ${String(1000 + i).padStart(4, '0')}`,
      whatsappOptIn: i % 2 === 0,
      privacyConsent: true,
    },
    null,
  );
  const portal = (await getPortal(token))!;
  const id = portal.booking.id;
  const reach = (status: Spec['target']) => {
    const order = ['NEW', 'IN_REVIEW', 'ON_HOLD', 'QUOTE_SENT', 'CHANGES', 'AWAITING_DEPOSIT', 'SIGNED', 'CONFIRMED', 'COMPLETED'];
    return s.target !== 'CANCELLED' && order.indexOf(s.target) >= order.indexOf(status);
  };

  if (s.target === 'CANCELLED') {
    await adminChangeStatus(id, 'IN_REVIEW', manager);
    await adminAddNote(id, manager, 'Client postponed indefinitely; asked us to close the request.');
    await adminChangeStatus(id, 'CANCELLED', manager, 'Client withdrew');
  }
  if (reach('IN_REVIEW')) {
    await adminChangeStatus(id, 'IN_REVIEW', manager);
    await adminAddNote(id, manager, 'Checked routing against existing travel; date looks workable.');
  }
  if (s.target === 'ON_HOLD') await adminHoldDate(id, manager, 7);
  if (reach('QUOTE_SENT')) {
    const travel = portal.booking.travelRequired ? 2_400_000 : 0;
    const rooms = portal.booking.accommodationRequired ? 1_150_000 : 0;
    const quote = await adminSaveQuote(
      id,
      {
        lines: [
          { kind: 'performance', description: 'Performance fee', amountCents: s.fee },
          ...(travel ? [{ kind: 'travel' as const, description: 'Flights and ground transport', amountCents: travel }] : []),
          ...(rooms ? [{ kind: 'accommodation' as const, description: 'Accommodation, two nights', amountCents: rooms }] : []),
          { kind: 'production', description: 'Backline and technical crew', amountCents: 1_800_000 },
        ],
        taxApplicable: true,
        taxRateBps: 1500,
        depositPercent: 50,
        depositDueDate: addDays(today, 7),
        balanceDueDate: s.days > 30 ? addDays(date, -14) : addDays(today, 3),
        validUntil: addDays(today, 14),
        cancellationTerms: DEFAULT_CANCELLATION_TERMS,
        clientMessage: 'Thank you for the enquiry. Here is the proposal for your event.',
      },
      manager,
    );
    await adminSendQuote(quote.id, manager);
    if (s.target === 'CHANGES') await requestQuoteChanges(token, quote.id, 'Could the set run 90 minutes instead of 75, and can the band travel the morning of the show?');
    if (reach('AWAITING_DEPOSIT')) await acceptQuote(token, quote.id);
    if (reach('SIGNED')) {
      const p = (await getPortal(token))!;
      await signContract(token, p.contract!.id, s.name, true, '198.51.100.7');
    }
    if (reach('CONFIRMED')) {
      await adminRecordManualPayment(id, 'deposit', quote.depositCents, 'EFT DEMO-' + (i + 1), manager);
      await adminConfirmBooking(id, owner, false);
    }
    if (reach('COMPLETED')) {
      await adminRecordManualPayment(id, 'balance', quote.balanceCents, 'EFT DEMO-B' + (i + 1), manager);
      await adminChangeStatus(id, 'COMPLETED', manager, 'Show delivered');
    }
  }
  created.push(`${reference}  ${(await getPortal(token))!.booking.status.padEnd(16)} ${date}  ${s.city}`);
}

// ── Calendar: travel and blocked days management sets by hand ──
await adminSetAvailability(addDays(today, 45), 'TRAVEL', 'In transit (demo)', manager);
await adminSetAvailability(addDays(today, 46), 'TRAVEL', 'In transit (demo)', manager);
await adminSetAvailability(addDays(today, 80), 'UNAVAILABLE', 'Studio block (demo)', manager);

// ── Public listings (clearly samples) ──
const listings = [
  { title: 'Sample listing — festival headline set', venue: 'Sample Arena', city: 'Johannesburg', days: 52, ticket: true },
  { title: 'Sample listing — live with the band', venue: 'Sample Amphitheatre', city: 'Cape Town', days: 99, ticket: true },
  { title: 'Sample listing — summer open-air show', venue: 'Sample Beachfront', city: 'Durban', days: 140, ticket: false },
];
for (const l of listings) {
  const now = new Date().toISOString();
  await store.insert('events', {
    id: newId(),
    bookingId: null,
    kind: 'public',
    title: l.title,
    date: addDays(today, l.days),
    startTime: '20:00',
    endTime: null,
    venue: l.venue,
    city: l.city,
    country: 'South Africa',
    ticketUrl: l.ticket ? 'https://tickets.example.com/sample' : null,
    description: 'Demo data: a sample listing to show how public dates appear. Replace with real, confirmed dates before launch.',
    published: true,
    createdAt: now,
    updatedAt: now,
  });
}

// ── Community and proposals ──
for (let i = 1; i <= 6; i++) {
  const emailConsent = i !== 6;
  const whatsappConsent = i % 2 === 1 || i === 6;
  await store.insert('community_signups', {
    id: newId(),
    email: `fan${i}@example.com`,
    phone: whatsappConsent ? `+27 83 555 ${String(2000 + i)}` : null,
    emailConsent,
    whatsappConsent,
    consentText: [emailConsent && CONSENT_TEXT.email, whatsappConsent && CONSENT_TEXT.whatsapp].filter(Boolean).join(' / '),
    source: i % 3 ? 'community' : 'home',
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  });
}
const proposals = [
  { type: 'brand', name: 'Demo Partnerships Lead', org: 'Sample Beverages (demo)', status: 'new', msg: 'We would like to discuss a summer campaign built around live performance content.' },
  { type: 'cultural', name: 'Demo Programme Director', org: 'Sample Arts Trust (demo)', status: 'reviewed', msg: 'A heritage-month programme pairing a performance with a youth production workshop.' },
  { type: 'music', name: 'Demo Producer', org: null, status: 'archived', msg: 'Sending a demo for a possible feature. Stems available on request.' },
] as const;
for (const [i, p] of proposals.entries()) {
  await store.insert('collaboration_requests', {
    id: newId(),
    type: p.type,
    name: p.name,
    organisation: p.org,
    email: `proposal${i + 1}@example.com`,
    phone: null,
    timeline: i === 0 ? 'Next quarter' : null,
    budget: i === 0 ? 'To discuss' : null,
    message: p.msg,
    status: p.status,
    createdAt: new Date(Date.now() - (i + 1) * 3 * 86_400_000).toISOString(),
  });
}

console.log(`\nDemo data written to the ${store.kind} store.\n`);
for (const line of created) console.log(`  ${line}`);
console.log(`\n  ${listings.length} sample public listings, 6 community signups, ${proposals.length} proposals, 3 calendar blocks.`);
console.log(`\nSign in at /admin with any of: ${people.map((p) => `${p.email} (${p.role})`).join(', ')}`);
console.log(`Password: ${DEMO_PASSWORD}${process.env.DEMO_PASSWORD ? '' : '  — set DEMO_PASSWORD to choose another'}\n`);
if ('end' in store && typeof store.end === 'function') await store.end();
