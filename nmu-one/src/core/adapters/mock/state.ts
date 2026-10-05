import type {
  AppNotification,
  LocationShare,
  MentoringOpportunity,
  Order,
  PaymentIntent,
  Pledge,
  Receipt,
  ResidenceRequest,
  Role,
  SharingScope,
  StudySpaceBooking,
  Ticket,
  User,
} from '../../domain/models';
import type { PersonaId } from '../contracts';
import { personas } from '../../fixtures/people';
import { providerContext } from '../runtime';
import { clock } from '../../time/clock';
import { addDays, sastDate, sastParts } from '../../time/sast';

/**
 * In-memory state behind the mock adapters for one app session — what a real
 * back end would persist. Reset on launch (and between tests), so every demo
 * starts from the same story.
 */
export interface MockState {
  users: Record<string, User>;
  payments: Record<string, PaymentIntent>;
  receipts: Record<string, Receipt>;
  /** Payments applied to the fee account this session, in cents. */
  feePaymentsCents: number;
  orders: Order[];
  /** Study-space bookings, each owned by the person who made it. */
  bookings: (StudySpaceBooking & { userId: string })[];
  tickets: Ticket[];
  joinedSocieties: Set<string>;
  residenceRequests: ResidenceRequest[];
  readNotifications: Set<string>;
  /** Notifications delivered this session, per user. */
  delivered: Record<string, AppNotification[]>;
  mentoringResponses: Record<string, MentoringOpportunity['status']>;
  pledges: Pledge[];
  locationShares: Record<string, LocationShare>;
  /** What the demo student shares with the demo parent. */
  guardianSharing: SharingScope[];
  listeners: Set<(n: AppNotification) => void>;
  timers: ReturnType<typeof setTimeout>[];
  sequence: number;
}

/**
 * Thandi already has a silent pod booked later in the week, so Library →
 * My bookings shows a real booking before the pitch journey adds another.
 */
function seededBookings(): MockState['bookings'] {
  const p = sastParts(addDays(clock.now(), 2));
  return [
    {
      id: 'bk-seed-1',
      userId: personas.student.id,
      spaceId: 'sp1',
      spaceName: 'Silent Pod 1',
      start: sastDate(p.year, p.month, p.day, 16).toISOString(),
      end: sastDate(p.year, p.month, p.day, 17).toISOString(),
      status: 'confirmed',
      reference: 'LIB-48213',
    },
  ];
}

function fresh(): MockState {
  return {
    users: Object.fromEntries(
      Object.values(personas).map((u) => [u.id, { ...u, roles: [...u.roles] }]),
    ),
    payments: {},
    receipts: {},
    feePaymentsCents: 0,
    orders: [],
    bookings: seededBookings(),
    tickets: [],
    joinedSocieties: new Set(),
    residenceRequests: [],
    readNotifications: new Set(),
    delivered: {},
    mentoringResponses: {},
    pledges: [],
    locationShares: {},
    guardianSharing: ['key-dates', 'fees'],
    listeners: new Set(),
    timers: [],
    sequence: 1000,
  };
}

export let state: MockState = fresh();

export function resetMockState(): void {
  state.timers.forEach(clearTimeout);
  state = fresh();
}

export const nextId = (prefix: string) => `${prefix}-${++state.sequence}`;

/** A human-readable reference, e.g. "NMU-4F2K9". */
export function reference(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let n = ++state.sequence * 7919;
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + 13 * (i + 1);
  }
  return `${prefix}-${out}`;
}

/** Which demo story a user belongs to. */
export function personaOf(userId: string): PersonaId {
  const entry = (Object.entries(personas) as [PersonaId, User][]).find(([, u]) => u.id === userId);
  return entry ? entry[0] : 'student';
}

/** The role a user is acting in: the session's active role, if they hold it. */
export function roleOf(userId: string): Role {
  const roles = state.users[userId]?.roles ?? ['student'];
  const ctx = providerContext.get();
  if (ctx.userId === userId && ctx.role && roles.includes(ctx.role)) return ctx.role;
  return roles[0] ?? 'student';
}

/** Delivers a notification to one user, and to the app if they are the one signed in. */
export function deliver(userId: string, n: AppNotification, signedInUserId: string | null): void {
  state.delivered[userId] = [n, ...(state.delivered[userId] ?? [])];
  if (signedInUserId === userId) state.listeners.forEach((l) => l(n));
}

export function later(ms: number, fn: () => void): void {
  state.timers.push(setTimeout(fn, ms));
}
