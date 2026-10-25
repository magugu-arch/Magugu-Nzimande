/**
 * Guest profiles (brief §13.8 "one guest profile"), with POPIA data
 * minimisation: name, email and mobile only, plus what the guest chooses to
 * add. Erasure keeps a contact hash so an opt-out is still honoured later.
 */

import type { Ctx } from './context.ts';
import { audit } from './context.ts';
import type { Actor, Channel, Guest, GuestPreference, NotificationCategory, SuppressionEntry } from './types.ts';
import { DomainError, isValidEmail, isValidName, normaliseEmail, normalisePhone } from './util/core.ts';
import { sha256Hex } from './util/sha256.ts';

export function contactHashOf(email: string | null, phone: string | null): string {
  const basis = email ? normaliseEmail(email) : (phone ?? '');
  return sha256Hex(`tashas-contact:${basis}`);
}

/** Defaults are conservative: service messages on, marketing off until consented. */
export const DEFAULT_PREFERENCES: { category: NotificationCategory; enabled: boolean; channels: Channel[] }[] = [
  { category: 'booking', enabled: true, channels: ['in-app', 'email'] },
  { category: 'service', enabled: true, channels: ['in-app', 'email'] },
  { category: 'rewards', enabled: true, channels: ['in-app'] },
  { category: 'events', enabled: true, channels: ['in-app', 'email'] },
  { category: 'marketing', enabled: false, channels: [] },
];

export class GuestService {
  private ctx: Ctx;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  get(guestId: string): Guest {
    return this.ctx.db.require('guests', guestId);
  }

  create(input: { name: string; email: string | null; phone: string | null; isDemoPopulation?: boolean }): Guest {
    const { db, ids, clock } = this.ctx;
    const email = input.email ? normaliseEmail(input.email) : null;
    const phone = input.phone ? normalisePhone(input.phone) : null;
    return db.transaction(() => {
      const guest = db.insert('guests', {
        id: ids.id('gst'),
        name: input.name.trim(),
        email,
        phone,
        contactHash: contactHashOf(email, phone),
        birthday: null,
        homeBranchId: null,
        pushToken: null,
        pushTokenValid: false,
        utcOffsetMinutes: 120,
        createdAt: clock.now(),
        isDemoPopulation: input.isDemoPopulation ?? false,
        erasedAt: null,
      });
      this.ensurePreferences(guest.id);
      return guest;
    });
  }

  /** Finds the guest a booking belongs to, or creates one; keeps details current. */
  upsertFromDetails(input: { guestId: string | null; name: string; email: string; phone: string }): Guest {
    const { db } = this.ctx;
    if (!isValidName(input.name)) throw new DomainError('invalid_name', 'Enter the name the booking is under.');
    if (!isValidEmail(input.email)) throw new DomainError('invalid_email', 'Enter an email address like name@example.com.');
    const phone = normalisePhone(input.phone);
    if (!phone) throw new DomainError('invalid_phone', 'Enter a mobile number like 082 123 4567.');
    const email = normaliseEmail(input.email);

    const existing =
      (input.guestId ? db.get('guests', input.guestId) : undefined) ??
      db.where('guests', (g) => g.email === email && g.erasedAt === null)[0];
    if (existing && existing.erasedAt === null) {
      return db.update('guests', existing.id, {
        name: input.name.trim(),
        email,
        phone,
        contactHash: contactHashOf(email, phone),
      });
    }
    return this.create({ name: input.name, email, phone });
  }

  /** The guest edits their own details; validated like a booking form. */
  updateContact(guestId: string, input: { name: string; email: string; phone: string }, actor: Actor): Guest {
    if (!isValidName(input.name)) throw new DomainError('invalid_name', 'Enter your name.');
    if (!isValidEmail(input.email)) throw new DomainError('invalid_email', 'Enter an email address like name@example.com.');
    const phone = normalisePhone(input.phone);
    if (!phone) throw new DomainError('invalid_phone', 'Enter a mobile number like 082 123 4567.');
    const email = normaliseEmail(input.email);
    const clash = this.ctx.db.where('guests', (g) => g.email === email && g.id !== guestId && g.erasedAt === null)[0];
    if (clash) throw new DomainError('email_in_use', 'That email belongs to another profile.');
    const row = this.ctx.db.update('guests', guestId, {
      name: input.name.trim(),
      email,
      phone,
      contactHash: contactHashOf(email, phone),
    });
    audit(this.ctx, actor, 'guest.contact-updated', 'guest', guestId);
    return row;
  }

  ensurePreferences(guestId: string): void {
    const { db, clock } = this.ctx;
    for (const d of DEFAULT_PREFERENCES) {
      const id = `${guestId}:${d.category}`;
      if (!db.get('guestPreferences', id)) {
        db.insert('guestPreferences', {
          id,
          guestId,
          category: d.category,
          enabled: d.enabled,
          channels: d.channels,
          updatedAt: new Date(clock.now()).toISOString(),
        });
      }
    }
  }

  preferences(guestId: string): GuestPreference[] {
    this.ensurePreferences(guestId);
    return this.ctx.db.where('guestPreferences', (p) => p.guestId === guestId);
  }

  setPreference(guestId: string, category: NotificationCategory, patch: { enabled?: boolean; channels?: Channel[] }, actor: Actor): GuestPreference {
    const { db, clock } = this.ctx;
    this.ensurePreferences(guestId);
    const id = `${guestId}:${category}`;
    return db.transaction(() => {
      const current = db.require('guestPreferences', id);
      let channels = patch.channels ?? current.channels;
      // Booking and service messages always reach the in-app inbox.
      if ((category === 'booking' || category === 'service') && !channels.includes('in-app')) {
        channels = ['in-app', ...channels];
      }
      const enabled = category === 'booking' || category === 'service' ? true : (patch.enabled ?? current.enabled);
      const row = db.update('guestPreferences', id, { enabled, channels, updatedAt: new Date(clock.now()).toISOString() });
      audit(this.ctx, actor, 'preference.updated', 'guest', guestId, { category, enabled, channels: channels.join(',') });
      return row;
    });
  }

  registerPushToken(guestId: string, token: string): Guest {
    return this.ctx.db.update('guests', guestId, { pushToken: token, pushTokenValid: true });
  }

  /** POPIA access request: everything held about the guest, in one document. */
  exportData(guestId: string): Record<string, unknown> {
    const { db } = this.ctx;
    const guest = this.get(guestId);
    return {
      exportedAt: new Date(this.ctx.clock.now()).toISOString(),
      guest,
      preferences: db.where('guestPreferences', (p) => p.guestId === guestId),
      consents: db.where('guestConsents', (c) => c.guestId === guestId),
      bookings: db.where('bookings', (b) => b.guestId === guestId),
      payments: db
        .where('payments', (p) => p.guestId === guestId)
        .map(({ id, purpose, amountMinor, currency, status, createdAt }) => ({ id, purpose, amountMinor, currency, status, createdAt })),
      rewards: db.where('rewardLedger', (r) => r.guestId === guestId),
      vouchers: db.where('vouchers', (v) => v.guestId === guestId),
      notifications: db
        .where('notifications', (n) => n.guestId === guestId)
        .map(({ id, title, category, status, createdAt }) => ({ id, title, category, status, createdAt })),
    };
  }

  /**
   * POPIA deletion: removes personal details, keeps the contact hash on the
   * suppression list so marketing can never restart, and keeps financial and
   * booking records (without personal details) for the retention period.
   */
  erase(guestId: string, actor: Actor): Guest {
    const { db, ids, clock } = this.ctx;
    return db.transaction(() => {
      const guest = this.get(guestId);
      const entry: SuppressionEntry = {
        id: ids.id('sup'),
        contactHash: guest.contactHash,
        guestId,
        channel: 'all',
        reason: 'erasure',
        createdAt: clock.now(),
      };
      db.insert('suppression', entry);
      for (const f of db.where('favourites', (x) => x.guestId === guestId)) db.delete('favourites', f.id);
      audit(this.ctx, actor, 'guest.erased', 'guest', guestId);
      return db.update('guests', guestId, {
        name: 'Erased guest',
        email: null,
        phone: null,
        birthday: null,
        pushToken: null,
        pushTokenValid: false,
        erasedAt: clock.now(),
      });
    });
  }
}
