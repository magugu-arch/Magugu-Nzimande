import { config } from '../../config';
import type { Order, Vendor } from '../../domain/models';
import { addMoney, multiplyMoney } from '../../domain/money';
import { directory, southCampus } from '../../fixtures/campus';
import {
  disruptions,
  libraryCatalogue,
  menus,
  residence,
  routeDelayMinutes,
  shuttleRoutes,
  stopOffsets,
  studySpaces,
  vendors,
} from '../../fixtures/campusLife';
import { clock } from '../../time/clock';
import { sastParts } from '../../time/sast';
import { liveStatus, nextArrivals } from '../../transport/eta';
import type {
  CampusProvider,
  CommerceProvider,
  LibraryProvider,
  ResidenceProvider,
  TransportProvider,
} from '../contracts';
import { AdapterError } from '../errors';
import { providerContext, requireUser, simulate } from '../runtime';
import { deliver, later, nextId, reference, roleOf, state } from './state';

// ── Library ─────────────────────────────────────────────────────────────────

export const mockLibrary: LibraryProvider = {
  search: (query) =>
    simulate('library', () => {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (terms.length === 0) return libraryCatalogue;
      return libraryCatalogue.filter((r) => {
        const hay = `${r.title} ${r.authors.join(' ')} ${r.kind}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
    }),

  getStudySpaces: (day) =>
    simulate('library', () => {
      requireUser('library');
      const taken = state.bookings.filter((b) => b.status === 'confirmed');
      return studySpaces(new Date(day), clock.now()).map((space) => ({
        ...space,
        slots: space.slots.map((slot) => ({
          ...slot,
          available:
            slot.available && !taken.some((b) => b.spaceId === space.id && b.start === slot.start),
        })),
      }));
    }),

  bookStudySpace: ({ spaceId, start, end }) =>
    simulate('library', () => {
      const userId = requireUser('library');
      const space = studySpaces(new Date(start), clock.now()).find((s) => s.id === spaceId);
      const slot = space?.slots.find((s) => s.start === start);
      if (!space || !slot) throw new AdapterError('not-found', 'library');
      const clash = state.bookings.some(
        (b) => b.status === 'confirmed' && b.spaceId === spaceId && b.start === start,
      );
      if (!slot.available || clash) {
        throw new AdapterError('conflict', 'library', 'That slot has just been taken');
      }
      const booking = {
        id: nextId('bk'),
        spaceId,
        spaceName: space.name,
        start,
        end,
        status: 'confirmed' as const,
        reference: reference('LIB'),
      };
      state.bookings.unshift({ ...booking, userId });
      return booking;
    }),

  // Each person sees only their own bookings; everyone's count as taken.
  getBookings: () =>
    simulate('library', () => {
      const userId = requireUser('library');
      return state.bookings.filter((b) => b.userId === userId).map(({ userId: _, ...b }) => b);
    }),

  cancelBooking: (id) =>
    simulate('library', () => {
      const userId = requireUser('library');
      const booking = state.bookings.find((b) => b.id === id && b.userId === userId);
      if (!booking) throw new AdapterError('not-found', 'library');
      booking.status = 'cancelled';
      const { userId: _, ...rest } = booking;
      return rest;
    }),
};

// ── Transport ───────────────────────────────────────────────────────────────

export const mockTransport: TransportProvider = {
  getRoutes: () =>
    simulate('transport', () => shuttleRoutes.map((r) => liveStatus(r, clock.now()))),
  getArrivals: (stopId) =>
    simulate('transport', () => {
      const now = clock.now();
      return shuttleRoutes
        .map((r) => liveStatus(r, now))
        .flatMap((r) => nextArrivals(r, stopOffsets[r.id] ?? [], routeDelayMinutes[r.id] ?? 0, now))
        .filter((a) => !stopId || a.stopId === stopId)
        .sort((a, b) => a.etaMinutes - b.etaMinutes);
    }),
  getDisruptions: () => simulate('transport', () => disruptions),
};

// ── Residence ───────────────────────────────────────────────────────────────

export const mockResidence: ResidenceProvider = {
  getResidence: () =>
    simulate('residence', () => {
      const userId = requireUser('residence');
      if (roleOf(userId) !== 'student') return null;
      const r = residence(clock.now());
      return { ...r, requests: [...state.residenceRequests, ...r.requests] };
    }),

  submitRequest: ({ category, description }) =>
    simulate('residence', () => {
      const userId = requireUser('residence');
      if (roleOf(userId) !== 'student') throw new AdapterError('forbidden', 'residence');
      if (description.trim().length < 10) {
        throw new AdapterError('invalid', 'residence', 'Describe the problem in a few more words');
      }
      const request = {
        id: nextId('rr'),
        category,
        description: description.trim(),
        status: 'submitted' as const,
        createdAt: clock.now().toISOString(),
        reference: reference('RV'),
      };
      state.residenceRequests.unshift(request);
      return request;
    }),
};

// ── Campus ──────────────────────────────────────────────────────────────────

export const mockCampus: CampusProvider = {
  getMap: () => simulate('campus', () => southCampus),
  getDirectory: () =>
    simulate('campus', () => {
      requireUser('campus');
      return directory;
    }),
};

// ── Commerce ────────────────────────────────────────────────────────────────

const DAY_RANGES: Record<string, number[]> = {
  'Mon–Fri': [1, 2, 3, 4, 5],
  'Tue–Thu': [2, 3, 4],
  'Mon–Sun': [0, 1, 2, 3, 4, 5, 6],
};

/** Whether a vendor is trading at `now`, from its published hours. */
export function isOpenAt(vendor: Vendor, now: Date): boolean {
  const p = sastParts(now);
  const minutes = p.hours * 60 + p.minutes;
  return vendor.hours.some((h) => {
    const days = DAY_RANGES[h.days] ?? [];
    const [oh = 0, om = 0] = h.open.split(':').map(Number);
    const [ch = 0, cm = 0] = h.close.split(':').map(Number);
    return days.includes(p.weekday) && minutes >= oh * 60 + om && minutes < ch * 60 + cm;
  });
}

const withOpenState = (v: Vendor): Vendor => {
  const open = isOpenAt(v, clock.now());
  return { ...v, isOpen: open, acceptsOrders: v.acceptsOrders && open };
};

function advance(orderId: string, status: Order['status']) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status === 'cancelled' || order.status === 'collected') return;
  order.status = status;
  if (status === 'ready') {
    order.readyAt = clock.now().toISOString();
    const userId = providerContext.get().userId;
    const owner = (order as Order & { userId?: string }).userId ?? userId ?? '';
    deliver(
      owner,
      {
        id: `n-${order.id}-ready`,
        title: 'Your order is ready for pickup',
        body: `${order.vendorName} · ${order.pickupPoint} · Pickup code ${order.pickupCode}`,
        category: 'orders',
        priority: 'high',
        createdAt: clock.now().toISOString(),
        read: false,
        action: { label: 'View order', href: `/dining/order/${order.id}` },
        publisher: order.vendorName,
        expiresAt: null,
      },
      userId,
    );
  }
}

export const mockCommerce: CommerceProvider = {
  getVendors: () => simulate('commerce', () => vendors.map(withOpenState)),

  getMenu: (vendorId) =>
    simulate('commerce', () => {
      const menu = menus[vendorId];
      if (!menu) throw new AdapterError('not-found', 'commerce');
      return menu;
    }),

  placeOrder: ({ vendorId, lines, paymentId }) =>
    simulate('commerce', () => {
      const userId = requireUser('commerce');
      const vendor = vendors.map(withOpenState).find((v) => v.id === vendorId);
      if (!vendor) throw new AdapterError('not-found', 'commerce');
      if (!vendor.acceptsOrders)
        throw new AdapterError('unavailable', 'commerce', `${vendor.name} is closed`);
      const payment = state.payments[paymentId];
      if (!payment || payment.status !== 'succeeded' || payment.purpose !== 'order') {
        throw new AdapterError('invalid', 'commerce', 'Payment not completed');
      }
      const menu = menus[vendorId] ?? [];
      const orderLines = lines.map(({ itemId, quantity }) => {
        const item = menu.find((m) => m.id === itemId);
        if (!item || !item.available)
          throw new AdapterError('conflict', 'commerce', 'An item is no longer available');
        return { itemId, name: item.name, quantity, unitPrice: item.price };
      });
      const total = addMoney(...orderLines.map((l) => multiplyMoney(l.unitPrice, l.quantity)));
      if (total.cents !== payment.amount.cents) {
        throw new AdapterError(
          'conflict',
          'commerce',
          'The total changed — please review your order',
        );
      }
      const order: Order & { userId: string } = {
        id: nextId('ord'),
        userId,
        vendorId,
        vendorName: vendor.name,
        lines: orderLines,
        total,
        status: 'placed',
        placedAt: clock.now().toISOString(),
        readyAt: null,
        pickupCode: String(100 + (state.sequence % 900)),
        pickupPoint: vendor.pickupPoint,
        paymentId,
      };
      state.orders.unshift(order);
      later(2_500, () => advance(order.id, 'preparing'));
      later(config.orderReadySeconds * 1000, () => advance(order.id, 'ready'));
      return order;
    }),

  getOrder: (id) =>
    simulate(
      'commerce',
      () => {
        const order = state.orders.find((o) => o.id === id);
        if (!order) throw new AdapterError('not-found', 'commerce');
        return order;
      },
      { latencyMs: 150 },
    ),

  getOrders: () => simulate('commerce', () => state.orders),
};
