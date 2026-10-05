import { AdapterError } from '../../src/core/adapters/errors';
import { createMockProviders } from '../../src/core/adapters/registry';
import { state } from '../../src/core/adapters/mock/state';
import type { Role, SharingScope, User } from '../../src/core/domain/models';
import { formatMoney } from '../../src/core/domain/money';
import type { Capability } from '../../src/core/permissions/policy';
import { holdPayment, paymentApproved } from './auth';
import { HttpError } from './http';

/**
 * The NMU ONE contract (docs/INTEGRATIONS.md), route by route.
 *
 * Every route names the capability it needs. The server checks it with the
 * same policy the app uses (src/core/permissions/policy.ts), against the
 * person's role, lifecycle stage and, for parents, what the student shares.
 * The app's checks shape the experience; these are the security boundary.
 */

export const providers = createMockProviders();

export interface Ctx {
  userId: string;
  user: User;
  role: Role;
  consents: SharingScope[];
  body: Record<string, unknown>;
  query: URLSearchParams;
  params: Record<string, string>;
  base: string;
}

type Need = Capability | 'signed-in' | ((ctx: Ctx) => Capability | 'signed-in' | 'student-only');

export interface Route {
  method: 'GET' | 'POST';
  path: string;
  need: Need;
  /** Sensitive reads are written to the audit log (brief §24). */
  audit?: string;
  handle(ctx: Ctx): Promise<unknown>;
}

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !v) throw new HttpError(422, 'invalid', `${name} is required`);
  return v;
};

/** Who paid for what, so only the payer can confirm or read a payment. */
const payer = new Map<string, string>();
const PAYMENT_NEEDS: Record<string, Capability> = {
  fees: 'finance.pay',
  order: 'commerce.order',
  ticket: 'events.book',
  donation: 'alumni.giving',
};
const ownPayment = (ctx: Ctx) => {
  const id = ctx.params.id!;
  if (payer.get(id) !== ctx.userId) throw new AdapterError('not-found', 'finance');
  return id;
};

const p = providers;

export const ROUTES: Route[] = [
  // ── Identity ──────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/me/student',
    need: 'signed-in',
    handle: (c) => p.auth.getStudentProfile(c.userId),
  },
  {
    method: 'GET',
    path: '/v1/me/staff',
    need: 'signed-in',
    handle: (c) => p.auth.getStaffProfile(c.userId),
  },
  {
    method: 'POST',
    path: '/v1/me/lifecycle/alumni',
    need: 'lifecycle.graduate',
    audit: 'lifecycle: student → alumni',
    handle: (c) => p.auth.transitionToAlumni(c.userId),
  },

  // ── Academic ──────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/academic/timetable',
    need: 'academics.timetable',
    handle: (c) =>
      p.academic.getTimetable({
        from: str(c.query.get('from'), 'from'),
        to: str(c.query.get('to'), 'to'),
      }),
  },
  {
    method: 'GET',
    path: '/v1/academic/teaching',
    need: 'teaching.schedule',
    handle: (c) =>
      p.academic.getTeachingTimetable({
        from: str(c.query.get('from'), 'from'),
        to: str(c.query.get('to'), 'to'),
      }),
  },
  {
    method: 'GET',
    path: '/v1/academic/assessments',
    need: 'academics.exams',
    handle: () => p.academic.getExams(),
  },
  {
    method: 'GET',
    path: '/v1/academic/results',
    need: 'academics.results',
    audit: 'results viewed',
    handle: () => p.academic.getResults(),
  },
  {
    method: 'GET',
    path: '/v1/academic/progress',
    need: 'academics.results',
    handle: () => p.academic.getProgress(),
  },
  {
    method: 'GET',
    path: '/v1/academic/modules',
    need: 'academics.modules',
    handle: () => p.academic.getModules(),
  },
  {
    method: 'GET',
    path: '/v1/academic/calendar',
    need: 'academics.calendar',
    handle: () => p.academic.getAcademicCalendar(),
  },
  {
    method: 'GET',
    path: '/v1/learning/modules/:code/links',
    need: 'academics.modules',
    handle: (c) => p.learning.getLinks(c.params.code!),
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/finance/account',
    need: 'finance.view',
    audit: 'fee account viewed',
    handle: () => p.finance.getAccount(),
  },
  {
    method: 'GET',
    path: '/v1/finance/transactions',
    need: 'finance.view',
    handle: () => p.finance.getTransactions(),
  },
  {
    method: 'GET',
    path: '/v1/finance/funding',
    need: 'funding.view',
    audit: 'funding viewed',
    handle: () => p.finance.getFunding(),
  },
  {
    method: 'POST',
    path: '/v1/payments',
    need: (c) => PAYMENT_NEEDS[String(c.body.purpose)] ?? 'finance.pay',
    audit: 'payment started',
    handle: async (c) => {
      const intent = await p.finance.createPayment({
        amount: c.body.amount as never,
        method: c.body.method as never,
        purpose: c.body.purpose as never,
      });
      payer.set(intent.id, c.userId);
      // With a provider page switched on, the person completes the payment
      // there and comes back to `returnUrl`; otherwise it confirms directly.
      const returnUrl = typeof c.body.returnUrl === 'string' ? c.body.returnUrl : null;
      if (process.env.BFF_PAYMENT_PAGE === '1' && returnUrl) {
        holdPayment(intent.id, returnUrl);
        return {
          ...intent,
          status: 'awaiting-handoff',
          redirectUrl: `${c.base}/dev-pay/${intent.id}`,
        };
      }
      return intent;
    },
  },
  {
    method: 'POST',
    path: '/v1/payments/:id/confirm',
    need: 'signed-in',
    audit: 'payment confirmed',
    handle: async (c) => {
      const id = ownPayment(c);
      if (!paymentApproved(id))
        throw new AdapterError('conflict', 'finance', 'Payment not completed');
      return p.finance.confirmPayment(id);
    },
  },
  {
    method: 'GET',
    path: '/v1/payments/receipts/:id',
    need: 'signed-in',
    handle: (c) => p.finance.getReceipt(c.params.id!),
  },

  // ── Library ───────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/library/search',
    need: 'library.search',
    handle: (c) => p.library.search(c.query.get('q') ?? ''),
  },
  {
    method: 'GET',
    path: '/v1/library/spaces',
    need: 'library.book',
    handle: (c) => p.library.getStudySpaces(str(c.query.get('day'), 'day')),
  },
  {
    method: 'POST',
    path: '/v1/library/bookings',
    need: 'library.book',
    handle: (c) =>
      p.library.bookStudySpace({
        spaceId: str(c.body.spaceId, 'spaceId'),
        start: str(c.body.start, 'start'),
        end: str(c.body.end, 'end'),
      }),
  },
  {
    method: 'GET',
    path: '/v1/library/bookings',
    need: 'library.book',
    handle: () => p.library.getBookings(),
  },
  {
    method: 'POST',
    path: '/v1/library/bookings/:id/cancel',
    need: 'library.book',
    handle: (c) => p.library.cancelBooking(c.params.id!),
  },

  // ── Transport, residence, campus ──────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/transport/routes',
    need: 'transport.view',
    handle: () => p.transport.getRoutes(),
  },
  {
    method: 'GET',
    path: '/v1/transport/arrivals',
    need: 'transport.view',
    handle: (c) => p.transport.getArrivals(c.query.get('stop') ?? undefined),
  },
  {
    method: 'GET',
    path: '/v1/transport/disruptions',
    need: 'transport.view',
    handle: () => p.transport.getDisruptions(),
  },
  {
    method: 'GET',
    path: '/v1/residence',
    need: 'residence.view',
    handle: () => p.residence.getResidence(),
  },
  {
    method: 'POST',
    path: '/v1/residence/requests',
    need: 'residence.request',
    handle: (c) =>
      p.residence.submitRequest({
        category: str(c.body.category, 'category') as never,
        description: str(c.body.description, 'description'),
      }),
  },
  { method: 'GET', path: '/v1/campus/map', need: 'campus.map', handle: () => p.campus.getMap() },
  {
    method: 'GET',
    path: '/v1/campus/directory',
    need: 'directory.view',
    handle: () => p.campus.getDirectory(),
  },

  // ── Commerce ──────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/commerce/vendors',
    need: 'dining.view',
    handle: () => p.commerce.getVendors(),
  },
  {
    method: 'GET',
    path: '/v1/commerce/vendors/:id/menu',
    need: 'dining.view',
    handle: (c) => p.commerce.getMenu(c.params.id!),
  },
  {
    method: 'POST',
    path: '/v1/commerce/orders',
    need: 'commerce.order',
    handle: (c) =>
      p.commerce.placeOrder({
        vendorId: str(c.body.vendorId, 'vendorId'),
        lines: c.body.lines as never,
        paymentId: str(c.body.paymentId, 'paymentId'),
      }),
  },
  {
    method: 'GET',
    path: '/v1/commerce/orders',
    need: 'commerce.order',
    handle: () => p.commerce.getOrders(),
  },
  {
    method: 'GET',
    path: '/v1/commerce/orders/:id',
    need: 'commerce.order',
    handle: (c) => p.commerce.getOrder(c.params.id!),
  },

  // ── Events and societies ──────────────────────────────────────────────────
  { method: 'GET', path: '/v1/events', need: 'events.view', handle: () => p.community.getEvents() },
  {
    method: 'GET',
    path: '/v1/events/:id',
    need: 'events.view',
    handle: (c) => p.community.getEvent(c.params.id!),
  },
  {
    method: 'POST',
    path: '/v1/events/:id/tickets',
    need: 'events.book',
    handle: (c) =>
      p.community.bookTicket(
        c.params.id!,
        typeof c.body.paymentId === 'string' ? c.body.paymentId : null,
      ),
  },
  {
    method: 'GET',
    path: '/v1/me/tickets',
    need: 'events.view',
    handle: () => p.community.getTickets(),
  },
  {
    method: 'GET',
    path: '/v1/societies',
    need: 'events.view',
    handle: () => p.community.getSocieties(),
  },
  {
    method: 'POST',
    path: '/v1/societies/:id/membership',
    need: 'societies.join',
    handle: (c) => p.community.joinSociety(c.params.id!),
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/notifications',
    need: 'notifications.view',
    handle: () => p.notifications.list(),
  },
  {
    method: 'POST',
    path: '/v1/notifications/:id/read',
    need: 'notifications.view',
    handle: (c) => p.notifications.markRead(c.params.id!),
  },
  {
    method: 'POST',
    path: '/v1/notifications/read-all',
    need: 'notifications.view',
    handle: () => p.notifications.markAllRead(),
  },
  {
    method: 'POST',
    path: '/v1/me/devices',
    need: 'notifications.view',
    handle: async (c) => {
      const token = str(c.body.token, 'token');
      const platform = str(c.body.platform, 'platform');
      if (!['ios', 'android', 'web'].includes(platform))
        throw new HttpError(422, 'invalid', 'Unknown platform');
      devices.set(token, { userId: c.userId, platform, registeredAt: new Date().toISOString() });
      return undefined;
    },
  },

  // ── Support and safety ────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/support/safety-contacts',
    need: 'safety.view',
    handle: () => p.support.getSafetyContacts(),
  },
  {
    method: 'GET',
    path: '/v1/support/wellbeing',
    need: 'wellbeing.view',
    handle: () => p.support.getWellbeingServices(),
  },
  {
    method: 'GET',
    path: '/v1/support/routes',
    need: 'signed-in',
    handle: () => p.support.getSupportRoutes(),
  },
  {
    method: 'POST',
    path: '/v1/safety/location-shares',
    need: 'safety.share-location',
    audit: 'location sharing started',
    handle: (c) => p.support.startLocationShare({ minutes: Number(c.body.minutes) }),
  },
  {
    method: 'POST',
    path: '/v1/safety/location-shares/:id/stop',
    need: 'safety.share-location',
    audit: 'location sharing stopped',
    handle: (c) => p.support.stopLocationShare(c.params.id!),
  },
  {
    method: 'GET',
    path: '/v1/content/knowledge',
    need: 'search.assistant',
    handle: () => p.support.getKnowledge(),
  },

  // ── Guardians ─────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/guardian',
    need: 'guardian.linked-student',
    handle: () => p.guardian.getProfile(),
  },
  {
    method: 'GET',
    path: '/v1/guardian/students/:id/updates',
    need: 'guardian.linked-student',
    audit: 'guardian viewed student updates',
    handle: (c) => p.guardian.getUpdates(c.params.id!),
  },
  {
    method: 'GET',
    path: '/v1/guardian/students/:id/fees',
    need: 'guardian.fees',
    audit: 'guardian viewed student fees',
    handle: (c) => p.guardian.getStudentAccount(c.params.id!),
  },
  {
    method: 'GET',
    path: '/v1/me/guardians',
    need: () => 'student-only',
    handle: () => p.guardian.getMyGuardians(),
  },
  {
    method: 'POST',
    path: '/v1/me/guardians/:id/sharing',
    need: () => 'student-only',
    audit: 'student changed guardian sharing',
    handle: (c) => p.guardian.setGuardianSharing(c.params.id!, c.body.sharing as SharingScope[]),
  },

  // ── Alumni ────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/v1/alumni/profile',
    need: 'alumni.profile',
    handle: () => p.alumni.getProfile(),
  },
  {
    method: 'GET',
    path: '/v1/alumni/mentoring',
    need: 'alumni.mentoring',
    handle: () => p.alumni.getMentoring(),
  },
  {
    method: 'POST',
    path: '/v1/alumni/mentoring/:id',
    need: 'alumni.mentoring',
    handle: (c) => p.alumni.respondToMentoring(c.params.id!, c.body.accept === true),
  },
  { method: 'GET', path: '/v1/alumni/jobs', need: 'alumni.jobs', handle: () => p.alumni.getJobs() },
  {
    method: 'GET',
    path: '/v1/alumni/stories',
    need: 'alumni.profile',
    handle: () => p.alumni.getStories(),
  },
  {
    method: 'GET',
    path: '/v1/alumni/chapters',
    need: 'alumni.profile',
    handle: () => p.alumni.getChapters(),
  },
  {
    method: 'GET',
    path: '/v1/giving/campaigns',
    need: 'alumni.giving',
    handle: () => p.alumni.getCampaigns(),
  },
  {
    method: 'POST',
    path: '/v1/giving/pledges',
    need: 'alumni.giving',
    handle: (c) =>
      p.alumni.pledge({
        campaignId: str(c.body.campaignId, 'campaignId'),
        amount: c.body.amount as never,
        frequency: c.body.frequency as never,
        paymentId: str(c.body.paymentId, 'paymentId'),
      }),
  },
];

/** Push tokens by device. A production BFF stores these and sends through the push service. */
export const devices = new Map<
  string,
  { userId: string; platform: string; registeredAt: string }
>();

/** The person behind a session, from the identity store. */
export function userById(id: string): User {
  const user = state.users[id];
  if (!user) throw new HttpError(401, 'unauthorised', 'Unknown person');
  return user;
}

export const describeAmount = (cents: number) => formatMoney({ cents, currency: 'ZAR' });
