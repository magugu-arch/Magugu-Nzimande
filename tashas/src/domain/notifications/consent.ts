/**
 * Marketing consent and suppression (brief §13.7).
 *
 * Consent is per channel, recorded with the exact wording and version the
 * guest saw, where it was given and when; withdrawal is a new record, never
 * an edit. A global suppression list overrides every campaign audience, and
 * eligibility is re-checked at the moment of sending, not when the audience
 * was built. Booking and payment messages are service communications and do
 * not depend on marketing consent.
 */

import type { Ctx } from '../context.ts';
import { audit } from '../context.ts';
import type { Outbox } from '../outbox.ts';
import type { Actor, Channel, ConsentSource, Guest, GuestConsent, SuppressionEntry } from '../types.ts';
import { DomainError } from '../util/core.ts';

export const MARKETING_CHANNELS: Channel[] = ['email', 'push', 'sms', 'whatsapp'];

export class ConsentService {
  private ctx: Ctx;
  private outbox: Outbox;

  constructor(ctx: Ctx, outbox: Outbox) {
    this.ctx = ctx;
    this.outbox = outbox;
  }

  current(guestId: string, channel: Channel): GuestConsent | null {
    // Newest first; rows written in the same millisecond keep insertion order (stable sort).
    const rows = this.ctx.db
      .where('guestConsents', (c) => c.guestId === guestId && c.channel === channel)
      .reverse()
      .sort((a, b) => b.capturedAt - a.capturedAt);
    return rows[0] ?? null;
  }

  hasMarketingConsent(guestId: string, channel: Channel): boolean {
    return this.current(guestId, channel)?.status === 'granted';
  }

  history(guestId: string): GuestConsent[] {
    return this.ctx.db
      .where('guestConsents', (c) => c.guestId === guestId)
      .reverse()
      .sort((a, b) => b.capturedAt - a.capturedAt);
  }

  suppressionFor(guest: Guest, channel: Channel): SuppressionEntry | null {
    return (
      this.ctx.db.where(
        'suppression',
        (s) =>
          (s.guestId === guest.id || s.contactHash === guest.contactHash) &&
          (s.channel === channel || s.channel === 'all'),
      )[0] ?? null
    );
  }

  /** An explicit, unticked-by-default opt-in. Never bundled with booking terms. */
  grant(guestId: string, channel: Channel, source: ConsentSource, actor: Actor): GuestConsent {
    const { db, ids, clock } = this.ctx;
    if (!MARKETING_CHANNELS.includes(channel)) {
      throw new DomainError('invalid_channel', 'Marketing consent applies to email, push, SMS or WhatsApp.');
    }
    const guest = db.require('guests', guestId);
    if (guest.erasedAt) throw new DomainError('guest_erased', 'This profile has been erased.');
    if (channel === 'email' && !guest.email) throw new DomainError('no_email', 'Add an email address first.');
    const settings = db.require('settings', 'global');
    return db.transaction(() => {
      const existing = this.current(guestId, channel);
      if (existing?.status === 'granted') return existing;
      // A fresh opt-in lifts an earlier unsubscribe on that channel, but never
      // an erasure, hard bounce or complaint.
      for (const s of db.where(
        'suppression',
        (x) => (x.guestId === guestId || x.contactHash === guest.contactHash) && x.channel === channel && x.reason === 'unsubscribe',
      )) {
        db.delete('suppression', s.id);
      }
      const row = db.insert('guestConsents', {
        id: ids.id('cns'),
        guestId,
        contactHash: guest.contactHash,
        purpose: 'marketing',
        channel,
        status: 'granted',
        consentTextVersion: settings.consentTextVersion,
        consentText: settings.consentText,
        source,
        capturedAt: clock.now(),
        withdrawnAt: null,
      });
      const prefId = `${guestId}:marketing`;
      const pref = db.get('guestPreferences', prefId);
      if (pref) {
        db.update('guestPreferences', prefId, {
          enabled: true,
          channels: pref.channels.includes(channel) ? pref.channels : [...pref.channels, channel],
          updatedAt: new Date(clock.now()).toISOString(),
        });
      }
      audit(this.ctx, actor, 'consent.granted', 'guest', guestId, { channel, source, version: settings.consentTextVersion });
      this.outbox.publish({ type: 'guest.consent-changed', guestId, channel, status: 'granted' }, row.id);
      return row;
    });
  }

  /** Withdrawal takes effect immediately and adds the contact to suppression. */
  withdraw(guestId: string, channel: Channel, source: ConsentSource, actor: Actor): GuestConsent | null {
    const { db, ids, clock } = this.ctx;
    const guest = db.require('guests', guestId);
    const settings = db.require('settings', 'global');
    return db.transaction(() => {
      const now = clock.now();
      if (!this.suppressionFor(guest, channel)) {
        db.insert('suppression', {
          id: ids.id('sup'),
          contactHash: guest.contactHash,
          guestId,
          channel,
          reason: 'unsubscribe',
          createdAt: now,
        });
      }
      const prefId = `${guestId}:marketing`;
      const pref = db.get('guestPreferences', prefId);
      if (pref) {
        const channels = pref.channels.filter((c) => c !== channel);
        db.update('guestPreferences', prefId, {
          channels,
          enabled: channels.length > 0,
          updatedAt: new Date(now).toISOString(),
        });
      }
      // Anything already queued for this channel is stopped now, not at send time.
      for (const d of db.where(
        'notificationDeliveries',
        (x) => x.guestId === guestId && x.channel === channel && (x.status === 'queued' || x.status === 'retrying'),
      )) {
        const n = db.get('notifications', d.notificationId);
        if (n?.kind === 'marketing') db.update('notificationDeliveries', d.id, { status: 'blocked', lastError: 'opted-out', nextAttemptAt: null });
      }
      const existing = this.current(guestId, channel);
      if (existing?.status !== 'granted') {
        audit(this.ctx, actor, 'consent.withdrawn', 'guest', guestId, { channel, source, hadConsent: false });
        return existing;
      }
      const row = db.insert('guestConsents', {
        id: ids.id('cns'),
        guestId,
        contactHash: guest.contactHash,
        purpose: 'marketing',
        channel,
        status: 'withdrawn',
        consentTextVersion: settings.consentTextVersion,
        consentText: settings.consentText,
        source,
        capturedAt: now,
        withdrawnAt: now,
      });
      audit(this.ctx, actor, 'consent.withdrawn', 'guest', guestId, { channel, source });
      this.outbox.publish({ type: 'guest.consent-changed', guestId, channel, status: 'withdrawn' }, row.id);
      return row;
    });
  }
}
