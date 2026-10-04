import type { AppNotification, Role } from '../../domain/models';
import { addMoney } from '../../domain/money';
import { alumniProfiles, personas } from '../../fixtures/people';
import {
  campaigns,
  chapters,
  events,
  jobs,
  mentoringFor,
  notificationsFor,
  societies,
  stories,
} from '../../fixtures/community';
import { knowledge, safetyContacts, supportRoutes, wellbeingServices } from '../../fixtures/support';
import { clock } from '../../time/clock';
import { addDays, addMinutes } from '../../time/sast';
import type {
  AlumniProvider,
  CommunityProvider,
  NotificationProvider,
  SupportProvider,
} from '../contracts';
import { AdapterError } from '../errors';
import { providerContext, requireUser, simulate } from '../runtime';
import { nextId, personaOf, reference, roleOf, state } from './state';

const currentRole = (): Role | null => {
  const userId = providerContext.get().userId;
  return userId ? roleOf(userId) : null;
};

// ── Community ───────────────────────────────────────────────────────────────

const eventFor = (id: string) => {
  const e = events(clock.now()).find((x) => x.id === id);
  if (!e) throw new AdapterError('not-found', 'community');
  const issued = state.tickets.filter((t) => t.eventId === id && t.status === 'valid').length;
  return { ...e, spotsLeft: Math.max(0, e.spotsLeft - issued) };
};

export const mockCommunity: CommunityProvider = {
  getEvents: () =>
    simulate('community', () => {
      const role = currentRole();
      return events(clock.now())
        .filter((e) => !role || e.audience.includes(role))
        .map((e) => eventFor(e.id));
    }),

  getEvent: (id) => simulate('community', () => eventFor(id)),

  bookTicket: (eventId, paymentId) =>
    simulate('community', () => {
      const userId = requireUser('community');
      const event = eventFor(eventId);
      const existing = state.tickets.find((t) => t.eventId === eventId && t.status === 'valid');
      if (existing) return existing;
      if (event.ticketing === 'open-entry') {
        throw new AdapterError('invalid', 'community', 'No ticket needed for this event');
      }
      if (event.spotsLeft <= 0) throw new AdapterError('conflict', 'community', 'Sold out');
      if (event.ticketing === 'paid-ticket') {
        const p = paymentId ? state.payments[paymentId] : undefined;
        if (!p || p.status !== 'succeeded' || p.purpose !== 'ticket') {
          throw new AdapterError('invalid', 'community', 'Payment not completed');
        }
      }
      const user = state.users[userId]!;
      const ticket = {
        id: nextId('tkt'),
        eventId,
        eventTitle: event.title,
        holder: `${user.givenName} ${user.familyName}`,
        code: reference('TKT'),
        issuedAt: clock.now().toISOString(),
        start: event.start,
        venue: event.venue,
        status: 'valid' as const,
      };
      state.tickets.unshift(ticket);
      return ticket;
    }),

  getTickets: () =>
    simulate('community', () => {
      requireUser('community');
      return state.tickets;
    }),

  getSocieties: () =>
    simulate('community', () =>
      societies.map((s) => ({ ...s, members: s.members + (state.joinedSocieties.has(s.id) ? 1 : 0) })),
    ),

  joinSociety: (id) =>
    simulate('community', () => {
      requireUser('community');
      if (!societies.some((s) => s.id === id)) throw new AdapterError('not-found', 'community');
      const joined = !state.joinedSocieties.has(id);
      if (joined) state.joinedSocieties.add(id);
      else state.joinedSocieties.delete(id);
      return { societyId: id, joined };
    }),
};

/** Joined societies, read synchronously by the UI for toggle state. */
export const isJoined = (id: string) => state.joinedSocieties.has(id);

// ── Notifications ───────────────────────────────────────────────────────────

/** The notification feed for a user, as the delivery service holds it. */
function feedFor(userId: string): AppNotification[] {
  const user = state.users[userId];
  const persona = personaOf(userId);
  // A graduate's student-era notices are archived; the alumni feed starts fresh.
  const base =
    persona === 'student' && user?.lifecycle === 'alumni' ? [] : notificationsFor(persona, clock.now());
  return [...(state.delivered[userId] ?? []), ...base]
    .map((n) => ({ ...n, read: n.read || state.readNotifications.has(n.id) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const mockNotifications: NotificationProvider = {
  list: () => simulate('notifications', () => feedFor(requireUser('notifications'))),

  markRead: (id) =>
    simulate('notifications', () => {
      state.readNotifications.add(id);
    }, { latencyMs: 100 }),

  markAllRead: () =>
    simulate('notifications', () => {
      feedFor(requireUser('notifications')).forEach((n) => state.readNotifications.add(n.id));
    }, { latencyMs: 150 }),

  subscribe: (listener) => {
    state.listeners.add(listener);
    return () => {
      state.listeners.delete(listener);
    };
  },
};

// ── Support and safety ──────────────────────────────────────────────────────

export const mockSupport: SupportProvider = {
  getSafetyContacts: () => simulate('support', () => safetyContacts, { latencyMs: 120 }),
  getWellbeingServices: () => simulate('support', () => wellbeingServices),
  getSupportRoutes: () => simulate('support', () => supportRoutes),

  startLocationShare: ({ minutes }) =>
    simulate('support', () => {
      requireUser('support');
      if (minutes < 5 || minutes > 120) throw new AdapterError('invalid', 'support');
      const now = clock.now();
      const share = {
        id: nextId('loc'),
        startedAt: now.toISOString(),
        expiresAt: addMinutes(now, minutes).toISOString(),
        recipient: 'Campus Protection Services',
        status: 'active' as const,
      };
      state.locationShares[share.id] = share;
      return share;
    }),

  stopLocationShare: (id) =>
    simulate('support', () => {
      const share = state.locationShares[id];
      if (!share) throw new AdapterError('not-found', 'support');
      share.status = 'stopped';
      return share;
    }, { latencyMs: 150 }),

  getKnowledge: () =>
    simulate('support', () => knowledge(addDays(clock.now(), -12).toISOString()), { latencyMs: 80 }),
};

// ── Alumni ──────────────────────────────────────────────────────────────────

const requireAlumnus = () => {
  const userId = requireUser('alumni');
  if (roleOf(userId) !== 'alumni') throw new AdapterError('forbidden', 'alumni');
  return userId;
};

export const mockAlumni: AlumniProvider = {
  getProfile: () =>
    simulate('alumni', () => {
      const userId = requireAlumnus();
      const profile = alumniProfiles[userId];
      if (!profile) throw new AdapterError('not-found', 'alumni');
      return profile;
    }),

  getMentoring: () =>
    simulate('alumni', () =>
      mentoringFor(requireAlumnus()).map((m) => ({
        ...m,
        status: state.mentoringResponses[m.id] ?? m.status,
      })),
    ),

  respondToMentoring: (id, accept) =>
    simulate('alumni', () => {
      const userId = requireAlumnus();
      const m = mentoringFor(userId).find((x) => x.id === id);
      if (!m) throw new AdapterError('not-found', 'alumni');
      state.mentoringResponses[id] = accept ? 'accepted' : 'declined';
      return { ...m, status: state.mentoringResponses[id]! };
    }),

  getJobs: () =>
    simulate('alumni', () => {
      requireAlumnus();
      return jobs(clock.now());
    }),

  getCampaigns: () =>
    simulate('alumni', () =>
      campaigns.map((c) => {
        const mine = state.pledges.filter((p) => p.campaignId === c.id);
        return {
          ...c,
          raised: addMoney(c.raised, ...mine.map((p) => p.amount)),
          donors: c.donors + (mine.length > 0 ? 1 : 0),
        };
      }),
    ),

  pledge: ({ campaignId, amount, frequency, paymentId }) =>
    simulate('alumni', () => {
      requireAlumnus();
      if (!campaigns.some((c) => c.id === campaignId)) throw new AdapterError('not-found', 'alumni');
      const p = state.payments[paymentId];
      if (!p || p.status !== 'succeeded' || p.purpose !== 'donation') {
        throw new AdapterError('invalid', 'alumni', 'Payment not completed');
      }
      const pledge = {
        id: nextId('plg'),
        campaignId,
        amount,
        frequency,
        createdAt: clock.now().toISOString(),
        paymentId,
        reference: reference('GIV'),
      };
      state.pledges.unshift(pledge);
      return pledge;
    }),

  getStories: () => simulate('alumni', () => stories),
  getChapters: () => simulate('alumni', () => chapters(clock.now())),
};

export const demoUserIds = Object.values(personas).map((p) => p.id);
