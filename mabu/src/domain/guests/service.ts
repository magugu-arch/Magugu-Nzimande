import type { ServiceContext } from '../context';
import { audit, nowIso, requireOwnerOrStaff, requireRole } from '../context';
import { DomainError } from '../shared/errors';
import { cleanNote, isEmail, normalisePhone } from '../shared/validation';
import type { Actor, DietaryTag, Favourite, FavouriteKind, Guest, GuestOccasion } from './types';

export interface ProfilePatch {
  name?: string;
  phone?: string;
  preferences?: Guest['preferences'];
}

/** Profile, occasions, favourites and the staff-facing guest CRM (§16, §18). */
export class GuestsService {
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * Finds or creates the guest for a verified email. Only the auth layer calls
   * this, after the one-time code has been checked.
   */
  findOrCreate(input: {
    email: string;
    name?: string;
    phone?: string;
    referralCode?: string;
  }): Guest {
    const email = input.email.trim().toLowerCase();
    if (!isEmail(email))
      throw new DomainError('VALIDATION', 'Please enter a valid email address.', 'email');
    const existing = this.ctx.db.guests.find((g) => g.email === email);
    if (existing) return existing;
    const referrer = input.referralCode
      ? this.ctx.db.guests.find((g) => g.referralCode === input.referralCode?.trim().toUpperCase())
      : undefined;
    return this.ctx.db.guests.insert({
      id: this.ctx.ids.id('gst'),
      name: input.name?.trim() ?? '',
      email,
      phone: (input.phone && normalisePhone(input.phone)) || '',
      role: 'guest',
      createdAt: nowIso(this.ctx),
      referredBy: referrer?.referralCode,
    });
  }

  get(guestId: string, actor: Actor): Guest {
    requireOwnerOrStaff(actor, guestId);
    return this.ctx.db.guests.require(guestId, 'guest');
  }

  updateProfile(guestId: string, patch: ProfilePatch, actor: Actor): Guest {
    requireOwnerOrStaff(actor, guestId);
    const next: Partial<Guest> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name.length < 2 || name.length > 80) {
        throw new DomainError('VALIDATION', 'Please enter your name.', 'name');
      }
      next.name = name;
    }
    if (patch.phone !== undefined) {
      const phone = normalisePhone(patch.phone);
      if (!phone)
        throw new DomainError('VALIDATION', 'Please enter a valid mobile number.', 'phone');
      next.phone = phone;
    }
    if (patch.preferences) {
      next.preferences = {
        ...patch.preferences,
        dietaryTags: [...new Set(patch.preferences.dietaryTags ?? [])] as DietaryTag[],
        accessibilityNotes: cleanNote(patch.preferences.accessibilityNotes, 300),
      };
    }
    return this.ctx.db.guests.update(guestId, next);
  }

  saveOccasion(
    guestId: string,
    occasion: Omit<GuestOccasion, 'id'> & { id?: string },
    actor: Actor,
  ): Guest {
    requireOwnerOrStaff(actor, guestId);
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(occasion.date)) {
      throw new DomainError('VALIDATION', 'Please choose the day and month.', 'date');
    }
    const guest = this.ctx.db.guests.require(guestId);
    const id = occasion.id ?? this.ctx.ids.id('occ');
    const occasions = (guest.occasions ?? []).filter((o) => o.id !== id);
    occasions.push({
      id,
      kind: occasion.kind,
      label: occasion.label.trim() || occasion.kind,
      date: occasion.date,
    });
    return this.ctx.db.guests.update(guestId, { occasions });
  }

  removeOccasion(guestId: string, occasionId: string, actor: Actor): Guest {
    requireOwnerOrStaff(actor, guestId);
    const guest = this.ctx.db.guests.require(guestId);
    return this.ctx.db.guests.update(guestId, {
      occasions: (guest.occasions ?? []).filter((o) => o.id !== occasionId),
    });
  }

  /**
   * POPIA §23: everything Mábu holds about one guest, in one answer, so they
   * can see it and keep a copy. Only what belongs to them — never another
   * guest's record, and never a staff note, which is written about service
   * rather than to the guest.
   */
  exportAccount(guestId: string, actor: Actor) {
    requireOwnerOrStaff(actor, guestId);
    const guest = this.ctx.db.guests.require(guestId);
    const mine = <T extends { guestId?: string }>(rows: T[]) =>
      rows.filter((r) => r.guestId === guestId);
    const bookings = this.ctx.db.reservations.filter((r) => r.guestId === guestId);
    const accounts = this.ctx.db.rewardAccounts.filter((a) => a.guestId === guestId);
    return {
      exportedAt: nowIso(this.ctx),
      about:
        'Everything Mábu holds about you. Bookings and payments are kept for tax and accounting even if you delete your account, but without your name or contact details.',
      you: {
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        joined: guest.createdAt,
        preferences: guest.preferences,
        occasions: guest.occasions,
        consent: guest.consent,
        rewardsMember: guest.rewardsOptIn === true,
        referralCode: guest.referralCode,
      },
      bookings: bookings.map((r) => ({
        reference: r.reference,
        startsAt: r.startsAt,
        partySize: r.partySize,
        status: r.status,
        occasion: r.occasionNote,
        dietaryNotes: r.dietaryNotes,
        accessibilityNotes: r.accessibilityNotes,
        specialRequest: r.specialRequest,
        createdAt: r.createdAt,
      })),
      events: mine(this.ctx.db.experienceBookings.list()).map((b) => ({
        event: this.ctx.db.experiences.get(b.eventId)?.title ?? b.eventId,
        seats: b.seats,
        status: b.status,
        reference: b.reference,
        createdAt: b.createdAt,
      })),
      vouchers: this.ctx.db.vouchers
        .filter((v) => v.purchaserGuestId === guestId || v.issuedTo === guestId)
        .map((v) => ({
          code: v.code,
          amountCents: v.amountCents,
          remainingCents: v.remainingCents,
          status: v.status,
          createdAt: v.createdAt,
        })),
      rewards: accounts.map((a) => ({
        balancePoints: a.balancePoints,
        lifetimePoints: a.lifetimePoints,
        tier: a.tierId,
        joinedAt: a.createdAt,
        ledger: this.ctx.db.rewardTransactions
          .filter((t) => t.accountId === a.id)
          .map((t) => ({
            at: t.createdAt,
            points: t.points,
            type: t.type,
            description: t.description,
          })),
      })),
      favourites: mine(this.ctx.db.favourites.list()).map((f) => ({
        kind: f.kind,
        itemId: f.itemId,
        savedAt: f.createdAt,
      })),
      notifications: {
        preferences: mine(this.ctx.db.notificationPreferences.list()).map((p) => ({
          category: p.category,
          enabled: p.enabled,
          channels: p.channels,
          quietHours: p.quietHours,
        })),
        messages: this.ctx.db.notificationMessages
          .filter((m) => m.guestId === guestId)
          .map((m) => ({ at: m.createdAt, about: m.templateKey, status: m.status })),
      },
      devices: mine(this.ctx.db.pushTokens.list()).map((t) => ({
        platform: t.platform,
        registeredAt: t.createdAt,
      })),
    };
  }

  /** POPIA: a guest can remove their personal data. Bookings keep a redacted record. */
  deleteAccount(guestId: string, actor: Actor): void {
    requireOwnerOrStaff(actor, guestId);
    for (const r of this.ctx.db.reservations.filter((x) => x.guestId === guestId)) {
      this.ctx.db.reservations.update(r.id, {
        guestName: 'Removed guest',
        guestEmail: '',
        guestPhone: '',
      });
    }
    for (const f of this.ctx.db.favourites.filter((x) => x.guestId === guestId))
      this.ctx.db.favourites.delete(f.id);
    for (const p of this.ctx.db.notificationPreferences.filter((x) => x.guestId === guestId)) {
      this.ctx.db.notificationPreferences.delete(p.id);
    }
    this.ctx.db.guests.delete(guestId);
    audit(this.ctx, actor, 'guest.deleted', 'guest', guestId);
  }

  /* ── Favourites ─────────────────────────────────────────────────────── */

  favourites(guestId: string, actor: Actor): Favourite[] {
    requireOwnerOrStaff(actor, guestId);
    return this.ctx.db.favourites.filter((f) => f.guestId === guestId);
  }

  toggleFavourite(guestId: string, kind: FavouriteKind, itemId: string, actor: Actor): boolean {
    requireOwnerOrStaff(actor, guestId);
    const id = `${guestId}:${kind}:${itemId}`;
    if (this.ctx.db.favourites.has(id)) {
      this.ctx.db.favourites.delete(id);
      return false;
    }
    this.ctx.db.favourites.insert({ id, guestId, kind, itemId, createdAt: nowIso(this.ctx) });
    this.ctx.analytics.track('favourite_added', { kind });
    return true;
  }

  /* ── Guest CRM (staff) ──────────────────────────────────────────────── */

  crmList(actor: Actor, term = ''): (Guest & { visits: number; upcoming: number })[] {
    requireRole(actor, 'staff', 'admin');
    const q = term.trim().toLowerCase();
    const now = this.ctx.clock.now().toISOString();
    return this.ctx.db.guests
      .filter(
        (g) =>
          g.role === 'guest' && (!q || g.name.toLowerCase().includes(q) || g.email.includes(q)),
      )
      .map((g) => {
        const res = this.ctx.db.reservations.filter((r) => r.guestId === g.id);
        return {
          ...g,
          visits: res.filter((r) => r.status === 'completed').length,
          upcoming: res.filter(
            (r) => r.startsAt > now && ['confirmed', 'rescheduled', 'requested'].includes(r.status),
          ).length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
