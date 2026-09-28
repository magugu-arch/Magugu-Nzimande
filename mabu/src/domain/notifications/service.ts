import type { ServiceContext } from '../context';
import { audit, nowIso, requireOwnerOrStaff, requireRole } from '../context';
import type { Actor } from '../guests/types';
import { DomainError } from '../shared/errors';
import { minutesOf, venueDate, venueTime } from '../shared/time';
import { isUpcoming } from '../reservations/status';
import { assertTemplateSafe, render } from './templates';
import {
  MARKETING_WEEKLY_CAP,
  NOTIFICATION_CATEGORIES,
  TRANSACTIONAL_CATEGORIES,
  type Campaign,
  type CampaignAudience,
  type InboxItem,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationDelivery,
  type NotificationMessage,
  type NotificationPreference,
  type NotificationProvider,
  type NotificationService,
  type NotificationTemplate,
  type QuietHours,
} from './types';

export const MAX_DELIVERY_ATTEMPTS = 4;
/** Back-off after the 1st, 2nd and 3rd failure. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];

const DEFAULT_CHANNELS: Record<NotificationCategory, NotificationChannel[]> = {
  booking: ['push', 'email', 'in-app'],
  event: ['push', 'email', 'in-app'],
  rewards: ['push', 'in-app'],
  voucher: ['email', 'in-app'],
  service: ['push', 'email', 'in-app'],
  marketing: ['email', 'in-app'],
};

type StoredMessage = NotificationMessage & { id: string };

/**
 * The central notification service (§37–42).
 *
 *   queue()      store once per dedupeKey; send now if due, else hold
 *   processDue() the job: sends what has come due and retries failures
 *   cancel()     withdraw a held message (a reminder for a moved booking)
 *
 * Every attempt is persisted as a NotificationDelivery. One delivery row per
 * (message, channel) — retries increment it rather than adding rows, so a
 * retried message can never reach a guest twice on the same channel.
 */
export class NotificationsService implements NotificationService {
  constructor(
    private readonly ctx: ServiceContext,
    private readonly providers: Partial<Record<NotificationChannel, NotificationProvider>>,
  ) {}

  /* ── Preferences (§39) ──────────────────────────────────────────────── */

  private defaultPreference(
    guestId: string,
    category: NotificationCategory,
  ): NotificationPreference {
    const guest = this.ctx.db.guests.get(guestId);
    return {
      id: `${guestId}:${category}`,
      guestId,
      category,
      enabled: category === 'marketing' ? guest?.consent?.marketing === true : true,
      channels: DEFAULT_CHANNELS[category],
      updatedAt: guest?.createdAt ?? nowIso(this.ctx),
    };
  }

  async getGuestPreferences(guestId: string): Promise<NotificationPreference[]> {
    return NOTIFICATION_CATEGORIES.map(
      (c) =>
        this.ctx.db.notificationPreferences.get(`${guestId}:${c}`) ??
        this.defaultPreference(guestId, c),
    );
  }

  private preference(guestId: string, category: NotificationCategory): NotificationPreference {
    return (
      this.ctx.db.notificationPreferences.get(`${guestId}:${category}`) ??
      this.defaultPreference(guestId, category)
    );
  }

  async updateGuestPreference(
    preference: NotificationPreference,
    actor: Actor = { id: preference.guestId, role: 'guest' },
  ): Promise<NotificationPreference> {
    requireOwnerOrStaff(actor, preference.guestId);
    const now = nowIso(this.ctx);
    const transactional = TRANSACTIONAL_CATEGORIES.includes(preference.category);
    const channels = [...new Set(preference.channels)];
    // The in-app centre is the guest's record of service messages; it stays on.
    if (transactional && !channels.includes('in-app')) channels.push('in-app');
    const next: NotificationPreference = {
      ...preference,
      id: `${preference.guestId}:${preference.category}`,
      enabled: transactional ? true : preference.enabled,
      channels,
      updatedAt: now,
    };
    if (preference.category === 'marketing') {
      next.consentTimestamp = now;
      next.consentSource = 'app:preference-centre';
      this.ctx.db.guests.update(preference.guestId, {
        consent: { marketing: next.enabled, updatedAt: now, source: 'app:preference-centre' },
      });
    }
    this.ctx.db.notificationPreferences.upsert(next);
    this.ctx.analytics.track('notification_preferences_updated', {
      category: next.category,
      enabled: next.enabled,
    });
    return next;
  }

  /** Quiet hours are set once and apply to every category. null clears them. */
  async setQuietHours(guestId: string, quietHours: QuietHours | null, actor: Actor): Promise<void> {
    requireOwnerOrStaff(actor, guestId);
    if (
      quietHours &&
      (!/^\d{2}:\d{2}$/.test(quietHours.start) || !/^\d{2}:\d{2}$/.test(quietHours.end))
    ) {
      throw new DomainError('VALIDATION', 'Please choose quiet hours again.', 'quiet hours');
    }
    for (const pref of await this.getGuestPreferences(guestId)) {
      this.ctx.db.notificationPreferences.upsert({
        ...pref,
        quietHours: quietHours ?? undefined,
        updatedAt: nowIso(this.ctx),
      });
    }
  }

  /** Global marketing opt-out (§39). */
  async optOutOfMarketing(guestId: string, actor: Actor): Promise<void> {
    const pref = this.preference(guestId, 'marketing');
    await this.updateGuestPreference({ ...pref, enabled: false }, actor);
  }

  /* ── Sending ────────────────────────────────────────────────────────── */

  async queue(message: NotificationMessage): Promise<void> {
    if (!this.ctx.flags.notificationsEnabled) return;
    // §42 dedupe. A cancelled message does not block its key: a reminder
    // withdrawn for a moved booking can be re-issued if the booking moves back.
    const live = this.ctx.db.notificationMessages.find(
      (m) => m.dedupeKey === message.dedupeKey && m.status !== 'cancelled',
    );
    if (live) return;
    const now = this.ctx.clock.now();
    const due = !message.scheduledFor || new Date(message.scheduledFor) <= now;
    const stored: StoredMessage = {
      ...message,
      id: this.ctx.db.notificationMessages.has(message.id) ? this.ctx.ids.id('ntf') : message.id,
      status: due ? 'queued' : 'scheduled',
      createdAt: now.toISOString(),
    };
    this.ctx.db.notificationMessages.insert(stored);
    if (due) await this.deliver(stored.id);
  }

  async sendNow(message: NotificationMessage): Promise<void> {
    await this.queue({ ...message, scheduledFor: undefined });
  }

  async cancel(dedupeKey: string): Promise<void> {
    const m = this.ctx.db.notificationMessages.find((x) => x.dedupeKey === dedupeKey);
    if (m && (m.status === 'scheduled' || m.status === 'queued')) {
      this.ctx.db.notificationMessages.update(m.id, { status: 'cancelled' });
      for (const d of this.ctx.db.notificationDeliveries.filter(
        (x) => x.notificationId === m.id && x.status === 'pending',
      )) {
        this.ctx.db.notificationDeliveries.update(d.id, {
          status: 'skipped',
          lastError: 'cancelled',
        });
      }
    }
  }

  /** The job (§44): sends what is due and retries what failed. Idempotent. */
  async processDue(): Promise<number> {
    const now = this.ctx.clock.now();
    let n = 0;
    for (const m of this.ctx.db.notificationMessages.filter(
      (x) => x.status === 'scheduled' && !!x.scheduledFor && new Date(x.scheduledFor) <= now,
    )) {
      this.ctx.db.notificationMessages.update(m.id, { status: 'queued' });
      await this.deliver(m.id);
      n += 1;
    }
    const retryIds = new Set(
      this.ctx.db.notificationDeliveries
        .filter(
          (d) =>
            d.status === 'pending' &&
            d.attempts < MAX_DELIVERY_ATTEMPTS &&
            (!d.nextAttemptAt || new Date(d.nextAttemptAt) <= now),
        )
        .map((d) => d.notificationId),
    );
    for (const id of retryIds) {
      await this.deliver(id);
      n += 1;
    }
    return n;
  }

  private async deliver(messageId: string): Promise<void> {
    const message = this.ctx.db.notificationMessages.require(messageId, 'notification');
    if (message.status === 'cancelled' || message.status === 'suppressed') return;
    const pref = this.preference(message.guestId, message.category);
    const guest = this.ctx.db.guests.get(message.guestId);

    // §42 / §48: no marketing without flag, consent and an enabled preference.
    if (message.category === 'marketing') {
      const reason = !this.ctx.flags.marketingNotificationsEnabled
        ? 'marketing notifications disabled'
        : guest?.consent?.marketing !== true
          ? 'no marketing consent'
          : !pref.enabled
            ? 'guest opted out'
            : undefined;
      if (reason) {
        this.ctx.db.notificationMessages.update(message.id, {
          status: 'suppressed',
          suppressedReason: reason,
        });
        return;
      }
    } else if (!pref.enabled && !TRANSACTIONAL_CATEGORIES.includes(message.category)) {
      this.ctx.db.notificationMessages.update(message.id, {
        status: 'suppressed',
        suppressedReason: 'guest disabled category',
      });
      return;
    }

    const channels = this.channelsFor(message, pref.channels);
    const now = this.ctx.clock.now();
    const quietUntil =
      !message.urgent && pref.quietHours ? quietHoursEnd(pref.quietHours, now) : null;

    for (const channel of channels) {
      const deliveryId = `${message.id}:${channel}`;
      let delivery: NotificationDelivery =
        this.ctx.db.notificationDeliveries.get(deliveryId) ??
        this.ctx.db.notificationDeliveries.insert({
          id: deliveryId,
          notificationId: message.id,
          channel,
          status: 'pending',
          attempts: 0,
        });
      if (delivery.status !== 'pending') continue;
      if (delivery.nextAttemptAt && new Date(delivery.nextAttemptAt) > now) continue;

      // Quiet hours hold interruptive channels only; in-app and email wait silently anyway.
      if (quietUntil && (channel === 'push' || channel === 'sms' || channel === 'whatsapp')) {
        this.ctx.db.notificationDeliveries.update(delivery.id, {
          nextAttemptAt: quietUntil.toISOString(),
        });
        continue;
      }

      const provider = this.providers[channel];
      if (!provider) {
        this.ctx.db.notificationDeliveries.update(delivery.id, {
          status: 'skipped',
          lastError: `no ${channel} provider`,
        });
        continue;
      }
      const template = this.template(message.templateKey, channel);
      const rendered = render(template, message.data);
      let result: Awaited<ReturnType<NotificationProvider['send']>>;
      try {
        result = await provider.send(message, rendered);
      } catch (error) {
        result = {
          accepted: false,
          reason: error instanceof Error ? error.message : 'send failed',
        };
      }
      const attempts = delivery.attempts + 1;
      if (result.accepted) {
        delivery = this.ctx.db.notificationDeliveries.update(delivery.id, {
          status: 'sent',
          attempts,
          providerMessageId: result.providerMessageId,
          sentAt: nowIso(this.ctx),
          templateVersion: rendered.templateVersion,
          nextAttemptAt: undefined,
        });
        this.ctx.analytics.track('notification_sent', { category: message.category, channel });
      } else if (result.reason?.endsWith('NOT_CONFIGURED')) {
        this.ctx.db.notificationDeliveries.update(delivery.id, {
          status: 'skipped',
          attempts,
          lastError: result.reason,
        });
      } else {
        const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS;
        this.ctx.db.notificationDeliveries.update(delivery.id, {
          status: exhausted ? 'failed' : 'pending',
          attempts,
          lastError: result.reason,
          nextAttemptAt: exhausted
            ? undefined
            : new Date(now.getTime() + (RETRY_DELAYS_MS[attempts - 1] ?? 3_600_000)).toISOString(),
        });
        this.ctx.analytics.track('notification_failed', { category: message.category, channel });
      }
    }
    this.refreshStatus(message.id);
  }

  private channelsFor(
    message: NotificationMessage,
    preferred: NotificationChannel[],
  ): NotificationChannel[] {
    const f = this.ctx.flags;
    const allowed: Record<NotificationChannel, boolean> = {
      push: f.pushEnabled,
      email: f.emailEnabled,
      sms: f.smsEnabled,
      whatsapp: f.whatsappEnabled,
      'in-app': true,
    };
    const set = message.channels.filter(
      (c) =>
        allowed[c] &&
        (preferred.includes(c) || (c === 'in-app' && message.category !== 'marketing')),
    );
    return [...new Set(set)];
  }

  private refreshStatus(messageId: string): void {
    const deliveries = this.ctx.db.notificationDeliveries.filter(
      (d) => d.notificationId === messageId,
    );
    const sent = deliveries.filter((d) => d.status === 'sent').length;
    const pending = deliveries.filter((d) => d.status === 'pending').length;
    const failed = deliveries.filter((d) => d.status === 'failed').length;
    const status =
      sent && !pending && !failed
        ? 'sent'
        : sent
          ? 'partially_sent'
          : pending
            ? 'queued'
            : failed
              ? 'failed'
              : 'sent';
    this.ctx.db.notificationMessages.update(messageId, {
      status,
      sentAt: sent ? nowIso(this.ctx) : undefined,
    });
  }

  /* ── Templates (§42) ────────────────────────────────────────────────── */

  template(key: string, channel: NotificationChannel): NotificationTemplate {
    const pick = (c: NotificationChannel) =>
      this.ctx.db.notificationTemplates
        .filter((t) => t.key === key && t.channel === c && t.active)
        .sort((a, b) => b.version - a.version)[0];
    const t =
      pick(channel) ??
      (channel === 'sms' || channel === 'whatsapp' ? pick('push') : undefined) ??
      pick('in-app');
    if (!t) throw new DomainError('NOT_FOUND', 'Message template missing.', `${key}:${channel}`);
    return t;
  }

  templates(): NotificationTemplate[] {
    return this.ctx.db.notificationTemplates
      .list()
      .sort(
        (a, b) =>
          a.key.localeCompare(b.key) || a.channel.localeCompare(b.channel) || b.version - a.version,
      );
  }

  /** Saves a new version; the previous one is kept, inactive, for the record. */
  saveTemplate(
    key: string,
    channel: NotificationChannel,
    subject: string,
    body: string,
    actor: Actor,
  ): NotificationTemplate {
    requireRole(actor, 'admin');
    if (!body.trim()) throw new DomainError('VALIDATION', 'The message body is empty.', 'body');
    assertTemplateSafe({ channel, subject, body });
    const previous = this.ctx.db.notificationTemplates.filter(
      (t) => t.key === key && t.channel === channel,
    );
    const version = Math.max(0, ...previous.map((t) => t.version)) + 1;
    for (const t of previous)
      if (t.active) this.ctx.db.notificationTemplates.update(t.id, { active: false });
    const saved = this.ctx.db.notificationTemplates.insert({
      id: `${key}:${channel}:v${version}`,
      key,
      channel,
      subject,
      body,
      version,
      active: true,
      updatedAt: nowIso(this.ctx),
      updatedBy: actor.id,
    });
    audit(this.ctx, actor, 'notification_template.saved', 'notification_template', saved.id, {
      version,
    });
    return saved;
  }

  /* ── Inbox ──────────────────────────────────────────────────────────── */

  inbox(guestId: string, actor: Actor): InboxItem[] {
    requireOwnerOrStaff(actor, guestId);
    return this.ctx.db.inbox
      .filter((i) => i.guestId === guestId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  markRead(itemId: string, actor: Actor): void {
    const item = this.ctx.db.inbox.require(itemId, 'message');
    requireOwnerOrStaff(actor, item.guestId);
    if (!item.readAt) {
      this.ctx.db.inbox.update(itemId, { readAt: nowIso(this.ctx) });
      this.ctx.analytics.track('notification_opened', { category: item.category });
    }
  }

  markAllRead(guestId: string, actor: Actor): void {
    requireOwnerOrStaff(actor, guestId);
    for (const i of this.ctx.db.inbox.filter((x) => x.guestId === guestId && !x.readAt)) {
      this.ctx.db.inbox.update(i.id, { readAt: nowIso(this.ctx) });
    }
  }

  /* ── Campaigns ──────────────────────────────────────────────────────── */

  scheduleCampaign(
    input: Pick<Campaign, 'name' | 'data' | 'deepLink' | 'scheduledFor' | 'audience'>,
    actor: Actor,
  ): Campaign {
    requireRole(actor, 'admin');
    if (!String(input.data.headline ?? '').trim()) {
      throw new DomainError('VALIDATION', 'A campaign needs a headline.', 'headline');
    }
    const campaign = this.ctx.db.campaigns.insert({
      id: this.ctx.ids.id('cmp'),
      name: input.name.trim() || String(input.data.headline),
      templateKey: 'marketing.campaign',
      audience: input.audience ?? 'all',
      data: input.data,
      deepLink: input.deepLink,
      scheduledFor: input.scheduledFor,
      status: 'scheduled',
      createdBy: actor.id,
      createdAt: nowIso(this.ctx),
    });
    audit(this.ctx, actor, 'campaign.scheduled', 'campaign', campaign.id, {
      scheduledFor: input.scheduledFor,
      audience: campaign.audience,
    });
    return campaign;
  }

  cancelCampaign(campaignId: string, actor: Actor): void {
    requireRole(actor, 'admin');
    const c = this.ctx.db.campaigns.require(campaignId, 'campaign');
    if (c.status === 'scheduled') this.ctx.db.campaigns.update(c.id, { status: 'cancelled' });
    audit(this.ctx, actor, 'campaign.cancelled', 'campaign', c.id);
  }

  /** Whether a guest belongs to a campaign audience, judged at send time. */
  inAudience(guestId: string, audience: CampaignAudience = 'all'): boolean {
    if (audience === 'all') return true;
    const guest = this.ctx.db.guests.get(guestId);
    if (!guest) return false;
    const now = this.ctx.clock.now().getTime();
    const DAY = 86_400_000;
    if (audience === 'members') return guest.rewardsOptIn === true;
    if (audience === 'birthday-month') {
      const month = venueDate(this.ctx.clock.now()).slice(5, 7);
      return !!guest.occasions?.some((o) => o.kind === 'birthday' && o.date.slice(0, 2) === month);
    }
    const mine = this.ctx.db.reservations.filter((r) => r.guestId === guestId);
    const visits = mine
      .filter((r) => r.status === 'completed')
      .map((r) => new Date(r.startsAt).getTime());
    if (audience === 'regulars') return visits.filter((t) => now - t <= 90 * DAY).length >= 3;
    // lapsed: has visited, not in sixty days, and nothing booked ahead
    if (!visits.length || now - Math.max(...visits) < 60 * DAY) return false;
    return !mine.some((r) => isUpcoming(r, this.ctx.clock.now()));
  }

  /** Marketing messages this guest has been sent in the last seven days. */
  marketingThisWeek(guestId: string): number {
    const since = this.ctx.clock.now().getTime() - 7 * 86_400_000;
    return this.ctx.db.notificationMessages.count(
      (m) =>
        m.guestId === guestId &&
        m.category === 'marketing' &&
        m.status !== 'suppressed' &&
        m.status !== 'cancelled' &&
        new Date(m.createdAt ?? 0).getTime() >= since,
    );
  }

  /** Admin preview: how many guests an audience reaches today. */
  audienceSize(audience: CampaignAudience): { inAudience: number; reachable: number } {
    let inAudience = 0;
    let reachable = 0;
    for (const g of this.ctx.db.guests.filter((x) => x.role === 'guest')) {
      if (!this.inAudience(g.id, audience)) continue;
      inAudience += 1;
      if (g.consent?.marketing === true && this.preference(g.id, 'marketing').enabled)
        reachable += 1;
    }
    return { inAudience, reachable };
  }

  /**
   * Job: sends campaigns that have come due — to guests in the audience who
   * consented, and who have not already had this week's marketing (§41, §42).
   */
  async runCampaigns(): Promise<Campaign[]> {
    const now = this.ctx.clock.now();
    const out: Campaign[] = [];
    for (const c of this.ctx.db.campaigns.filter(
      (x) => x.status === 'scheduled' && new Date(x.scheduledFor) <= now,
    )) {
      let recipients = 0;
      let blocked = 0;
      let capped = 0;
      for (const g of this.ctx.db.guests.filter((x) => x.role === 'guest')) {
        if (!this.inAudience(g.id, c.audience)) continue;
        const pref = this.preference(g.id, 'marketing');
        if (
          !this.ctx.flags.marketingNotificationsEnabled ||
          g.consent?.marketing !== true ||
          !pref.enabled
        ) {
          blocked += 1;
          continue;
        }
        if (this.marketingThisWeek(g.id) >= MARKETING_WEEKLY_CAP) {
          capped += 1;
          continue;
        }
        await this.queue({
          id: this.ctx.ids.id('ntf'),
          guestId: g.id,
          category: 'marketing',
          templateKey: c.templateKey,
          data: c.data,
          channels: ['push', 'email', 'in-app'],
          deepLink: c.deepLink,
          dedupeKey: `campaign:${c.id}:${g.id}`,
        });
        recipients += 1;
      }
      out.push(
        this.ctx.db.campaigns.update(c.id, {
          status: 'sent',
          sentAt: nowIso(this.ctx),
          recipients,
          blockedNoConsent: blocked,
          heldByCap: capped,
        }),
      );
    }
    return out;
  }

  /* ── Admin views ────────────────────────────────────────────────────── */

  recentMessages(limit = 50) {
    return this.ctx.db.notificationMessages
      .list()
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, limit)
      .map((m) => ({
        ...m,
        deliveries: this.ctx.db.notificationDeliveries.filter((d) => d.notificationId === m.id),
      }));
  }
}

/**
 * If `now` falls inside the quiet window, when the window ends; else null.
 * Handles windows that cross midnight (22:00 → 07:00).
 */
export function quietHoursEnd(q: QuietHours, now: Date): Date | null {
  const t = minutesOf(venueTime(now));
  const start = minutesOf(q.start);
  const end = minutesOf(q.end);
  if (start === end) return null;
  const inside = start < end ? t >= start && t < end : t >= start || t < end;
  if (!inside) return null;
  const minutesUntilEnd = (end - t + 24 * 60) % (24 * 60);
  const out = new Date(now.getTime() + minutesUntilEnd * 60_000);
  out.setUTCSeconds(0, 0);
  return out;
}
