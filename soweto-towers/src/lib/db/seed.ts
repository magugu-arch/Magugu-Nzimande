import 'server-only';
import { count, eq } from 'drizzle-orm';
import { activities } from '@/content/catalog';
import { seedEvents } from '@/content/events-seed';
import { hashPassword } from '@/lib/auth/password';
import { dayHours } from '@/lib/hours';
import { bookingRef, secretToken } from '@/lib/ids';
import { SETTINGS_DEFAULTS } from '@/lib/data/settings-types';
import { addDays, ymdInSast } from '@/lib/time';
import type { DB } from './index';
import * as s from './schema';

export const DEMO_STAFF = { email: 'crew@sowetotowers.co.za', password: 'jumpmaster', name: 'Demo crew' };

/** Settings, the first admin and starting events. Safe to run on every boot. */
export async function seedBase(db: DB): Promise<void> {
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await db.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.email, adminEmail));
    if (existing.length === 0) {
      await db.insert(s.staff).values({
        email: adminEmail,
        name: process.env.ADMIN_NAME ?? 'Admin',
        role: 'admin',
        passwordHash: await hashPassword(adminPassword),
      });
    }
  }

  if (process.env.SEED_SAMPLE_EVENTS !== '0') {
    const [{ n }] = (await db.select({ n: count() }).from(s.events)) as [{ n: number }];
    if (Number(n) === 0) {
      await db.insert(s.events).values(
        seedEvents.map((e) => ({
          slug: e.slug,
          title: e.title,
          tag: e.tag,
          summary: e.summary,
          body: e.body,
          startsAt: new Date(e.startsAt),
          endsAt: new Date(e.endsAt),
          image: e.image,
          price: e.price,
          capacity: e.capacity,
          status: 'published' as const,
        })),
      );
    }
  }
}

/**
 * Preview databases only: a demo crew login and a few clearly labelled sample
 * bookings, a chat and enquiries, so the staff console can be tried end to end.
 */
export async function seedDemo(db: DB): Promise<void> {
  const demoStaff = await db.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.email, DEMO_STAFF.email));
  if (demoStaff.length === 0) {
    await db.insert(s.staff).values({
      email: DEMO_STAFF.email,
      name: DEMO_STAFF.name,
      role: 'admin',
      passwordHash: await hashPassword(DEMO_STAFF.password),
    });
  }

  const [{ n }] = (await db.select({ n: count() }).from(s.bookings)) as [{ n: number }];
  if (Number(n) > 0) return;

  const today = ymdInSast(new Date());
  const openDays: string[] = [];
  for (let i = 0; openDays.length < 3 && i < 14; i++) {
    const d = dayHours(addDays(today, i));
    if (d.open) openDays.push(d.date);
  }
  const bungee = activities.find((a) => a.id === 'bungee-jump')!;
  const scad = activities.find((a) => a.id === 'scad-freefall')!;
  const names = [
    ['Thandi Mokoena', 'adventure', 'jump-film'],
    ['Sipho Ndlovu', 'adventure', 'the-jump'],
    ['Lerato & friends', 'adventure', 'full-tower'],
    ['Kagiso Dlamini', 'adventure', 'jump-film'],
    ['Ayesha Patel', 'adventure', 'the-jump'],
    ['Musa Khumalo', 'adventure', 'jump-film'],
  ] as const;
  const times = ['11:00', '12:30', '13:00', '14:30', '15:00', '16:30'];

  for (let i = 0; i < names.length; i++) {
    const [name, kind, pkg] = names[i]!;
    const date = openDays[i % openDays.length] ?? today;
    const qty = pkg === 'full-tower' ? 3 : 1 + (i % 2);
    const time = times[i % times.length]!;
    const withVideo = pkg !== 'the-jump';
    const unit = bungee.price + (withVideo ? 170 : 0) + (pkg === 'full-tower' ? scad.price : 0);
    const saving = pkg === 'jump-film' ? 40 : pkg === 'full-tower' ? 110 : 0;
    const total = (unit - saving) * qty;
    const [b] = await db
      .insert(s.bookings)
      .values({
        ref: bookingRef(),
        kind,
        status: 'paid',
        visitDate: date,
        name: `${name} (demo)`,
        email: `demo+${i}@example.com`,
        phone: '+27 82 000 0000',
        packageId: pkg,
        subtotal: unit * qty,
        discount: saving * qty,
        total,
        source: i % 3 === 0 ? 'instagram' : i % 3 === 1 ? 'google' : 'whatsapp',
        paymentProvider: 'demo',
        paymentRef: `DEMO-${i}`,
        paidAt: new Date(),
        ticketToken: secretToken(),
        clipConsent: i % 2 === 0,
        waiver: { signedName: name, signedAt: new Date().toISOString(), acceptedMedical: true, acceptedTerms: true, guardian: null },
        meta: { demo: true },
      })
      .returning({ id: s.bookings.id });
    await db.insert(s.bookingItems).values([
      {
        bookingId: b!.id,
        kind: 'activity',
        sku: 'bungee-jump',
        label: 'Bungee Jump',
        slotDate: date,
        slotTime: time,
        resource: 'bridge',
        units: qty,
        qty,
        unitPrice: bungee.price,
        total: bungee.price * qty,
      },
      ...(withVideo
        ? [{ bookingId: b!.id, kind: 'addon' as const, sku: 'video:bungee-jump', label: 'Full HD video · Bungee Jump', qty, unitPrice: 170, total: 170 * qty }]
        : []),
      ...(pkg === 'full-tower'
        ? [
            {
              bookingId: b!.id,
              kind: 'activity' as const,
              sku: 'scad-freefall',
              label: 'SCAD Freefall',
              slotDate: date,
              slotTime: times[(i + 1) % times.length]!,
              resource: 'scad',
              units: qty,
              qty,
              unitPrice: scad.price,
              total: scad.price * qty,
            },
          ]
        : []),
    ]);
    await db.insert(s.participants).values(
      Array.from({ length: qty }, (_, k) => ({
        bookingId: b!.id,
        name: k === 0 ? name.split(' ')[0]! : `Guest ${k + 1}`,
        weightKg: 60 + ((i * 7 + k * 11) % 40),
        ageBand: 'adult' as const,
        activities: pkg === 'full-tower' ? ['bungee-jump', 'scad-freefall'] : ['bungee-jump'],
      })),
    );
  }

  const [conv] = await db
    .insert(s.conversations)
    .values({ token: secretToken(), name: 'Nomsa (demo)', contact: '+27 82 000 0001', page: '/groups', unreadForStaff: 1 })
    .returning({ id: s.conversations.id });
  await db.insert(s.messages).values([
    { conversationId: conv!.id, sender: 'visitor', body: 'Hi! Can a group of 12 jump on a Friday afternoon? It’s for a 30th birthday.' },
    {
      conversationId: conv!.id,
      sender: 'bot',
      body: 'Thanks for asking! Groups of 6 or more get R50 off each bungee. A crew member will reply here shortly.',
    },
  ]);

  await db.insert(s.enquiries).values([
    {
      type: 'corporate',
      name: 'Zanele Mthembu (demo)',
      email: 'demo+hr@example.com',
      phone: '+27 82 000 0002',
      company: 'Demo Insurance Ltd',
      groupSize: 40,
      preferredDate: openDays[1] ?? today,
      message: 'Looking for a Thursday team day for 40 people with lunch, and we need an invoice for HR.',
    },
    {
      type: 'school',
      name: 'Mr Molefe (demo)',
      email: 'demo+school@example.com',
      groupSize: 60,
      message: 'Grade 10 heritage outing: lift ride and a talk about the towers.',
    },
  ]);

  await db.insert(s.tableRequests).values({
    name: 'Thandi Mokoena (demo)',
    phone: '+27 82 000 0000',
    date: openDays[0] ?? today,
    time: '13:30',
    partySize: 4,
    notes: 'After our 12:30 jump',
  });
}
