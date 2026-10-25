/**
 * Campaigns (brief §13.8).
 *
 * A marketer drafts, a different person with approval rights approves, and
 * only then can it be scheduled or sent. The audience preview applies the
 * same consent, suppression and cap checks the send will; the send itself
 * creates one notification per guest and the notification service checks
 * each one again at the moment it goes out. Reports distinguish what was
 * observed from what was blocked.
 */

import type { Ctx } from '../context.ts';
import { audit } from '../context.ts';
import type { NotificationService } from '../notifications/service.ts';
import { template } from '../notifications/templates.ts';
import type { RewardsService } from '../rewards/ledger.ts';
import { authorize } from '../roles.ts';
import type { Consumer } from '../outbox.ts';
import type {
  Actor,
  AudienceRule,
  Campaign,
  CampaignStats,
  Channel,
  Guest,
  NotificationRecord,
  TashasDomainEvent,
  Utm,
} from '../types.ts';
import { DAY, DomainError, maskName } from '../util/core.ts';

export const CONSENT_POLICY_VERSION = 'popia-sample-2026-10';

const EMPTY_STATS: CampaignStats = {
  targeted: 0,
  eligible: 0,
  excluded: {},
  sent: 0,
  delivered: 0,
  failed: 0,
  blockedAtSend: 0,
  optOuts: 0,
  conversions: 0,
  attributedBookings: 0,
};

export interface AudiencePreview {
  targeted: number;
  eligible: number;
  deferred: number;
  excluded: Record<string, number>;
  sample: string[];
}

export class CampaignService {
  private ctx: Ctx;
  private notifications: NotificationService;
  private rewards: RewardsService;

  constructor(ctx: Ctx, notifications: NotificationService, rewards: RewardsService) {
    this.ctx = ctx;
    this.notifications = notifications;
    this.rewards = rewards;
  }

  get(id: string): Campaign {
    return this.ctx.db.require('campaigns', id);
  }

  list(): Campaign[] {
    return this.ctx.db.all('campaigns').sort((a, b) => b.createdAt - a.createdAt);
  }

  private log(c: Campaign, actor: Actor, action: string): Campaign['history'] {
    return [...c.history, { at: this.ctx.clock.now(), actor: actor.role ?? actor.id, action }];
  }

  create(
    input: {
      name: string;
      channel: Channel;
      templateId: string;
      audience: AudienceRule;
      landingSlug: string;
      utm: Utm;
      frequencyCapPerWeek?: number;
      attributionWindowDays?: number;
    },
    actor: Actor,
  ): Campaign {
    authorize(actor, 'campaign.create');
    const tpl = template(input.templateId);
    if (tpl.kind !== 'marketing') throw new DomainError('invalid_template', 'Campaigns use marketing templates only.');
    if (!input.name.trim()) throw new DomainError('name_required', 'Name the campaign.');
    const now = this.ctx.clock.now();
    return this.ctx.db.transaction(() => {
      const c = this.ctx.db.insert('campaigns', {
        id: this.ctx.ids.id('cmp'),
        name: input.name.trim(),
        status: 'draft',
        channel: input.channel,
        templateId: input.templateId,
        audience: input.audience,
        audienceRuleVersion: 1,
        consentPolicyVersion: CONSENT_POLICY_VERSION,
        landingSlug: input.landingSlug,
        utm: input.utm,
        frequencyCapPerWeek: input.frequencyCapPerWeek ?? 2,
        attributionWindowDays: input.attributionWindowDays ?? 7,
        scheduledAt: null,
        createdBy: actor.id,
        approvedBy: null,
        sentAt: null,
        stats: EMPTY_STATS,
        history: [{ at: now, actor: actor.role ?? actor.id, action: 'created' }],
        createdAt: now,
        updatedAt: now,
      });
      audit(this.ctx, actor, 'campaign.created', 'campaign', c.id, { name: c.name, channel: c.channel });
      return c;
    });
  }

  private transition(id: string, actor: Actor, from: Campaign['status'][], patch: Partial<Campaign>, action: string): Campaign {
    const c = this.get(id);
    if (!from.includes(c.status)) throw new DomainError('invalid_state', `A ${c.status} campaign cannot be ${action}.`);
    const updated = this.ctx.db.update('campaigns', id, {
      ...patch,
      history: this.log(c, actor, action),
      updatedAt: this.ctx.clock.now(),
    });
    audit(this.ctx, actor, `campaign.${action}`, 'campaign', id);
    return updated;
  }

  submitForApproval(id: string, actor: Actor): Campaign {
    authorize(actor, 'campaign.create');
    return this.transition(id, actor, ['draft'], { status: 'pending-approval' }, 'submitted');
  }

  approve(id: string, actor: Actor): Campaign {
    authorize(actor, 'campaign.approve');
    const c = this.get(id);
    if (c.createdBy === actor.id && actor.role !== 'admin') {
      throw new DomainError('self_approval', 'Someone other than the author must approve this campaign.');
    }
    return this.transition(id, actor, ['pending-approval'], { status: 'approved', approvedBy: actor.id }, 'approved');
  }

  reject(id: string, actor: Actor): Campaign {
    authorize(actor, 'campaign.approve');
    return this.transition(id, actor, ['pending-approval'], { status: 'draft' }, 'returned to draft');
  }

  schedule(id: string, at: number, actor: Actor): Campaign {
    authorize(actor, 'campaign.send');
    if (at < this.ctx.clock.now()) throw new DomainError('in_past', 'Choose a time in the future.');
    return this.transition(id, actor, ['approved', 'paused'], { status: 'scheduled', scheduledAt: at }, 'scheduled');
  }

  pause(id: string, actor: Actor): Campaign {
    authorize(actor, 'campaign.send');
    const c = this.transition(id, actor, ['scheduled', 'sending'], { status: 'paused' }, 'paused');
    this.notifications.cancelScheduled((n) => n.campaignId === id);
    return c;
  }

  cancel(id: string, actor: Actor): Campaign {
    authorize(actor, 'campaign.send');
    const c = this.transition(id, actor, ['draft', 'pending-approval', 'approved', 'scheduled', 'paused'], { status: 'cancelled' }, 'cancelled');
    this.notifications.cancelScheduled((n) => n.campaignId === id);
    return c;
  }

  // ------------------------------------------------------------ audience

  private completedVisits(guestId: string): number[] {
    return this.ctx.db
      .where('bookings', (b) => b.guestId === guestId && b.status === 'completed')
      .map((b) => b.startsAt)
      .sort((a, b) => b - a);
  }

  matches(guest: Guest, rule: AudienceRule): boolean {
    if (guest.erasedAt) return false;
    const now = this.ctx.clock.now();
    if (rule.branchIds.length > 0) {
      const affinity =
        (guest.homeBranchId !== null && rule.branchIds.includes(guest.homeBranchId)) ||
        this.ctx.db.where('bookings', (b) => b.guestId === guest.id && rule.branchIds.includes(b.branchId)).length > 0;
      if (!affinity) return false;
    }
    const visits = this.completedVisits(guest.id);
    if (rule.minCompletedVisits !== undefined && visits.length < rule.minCompletedVisits) return false;
    if (rule.lastVisitWithinDays !== undefined && !(visits[0] && now - visits[0] <= rule.lastVisitWithinDays * DAY)) return false;
    if (rule.inactiveForDays !== undefined && visits[0] && now - visits[0] < rule.inactiveForDays * DAY) return false;
    if (rule.rewardTier && this.rewards.summary(guest.id).tier.id !== rule.rewardTier) return false;
    return true;
  }

  audience(campaign: Campaign): Guest[] {
    return this.ctx.db.where('guests', (g) => this.matches(g, campaign.audience));
  }

  private probe(campaign: Campaign, guestId: string): NotificationRecord {
    const now = this.ctx.clock.now();
    return {
      id: 'probe',
      guestId,
      category: 'marketing',
      kind: 'marketing',
      templateId: campaign.templateId,
      templateVersion: 1,
      title: '',
      body: '',
      payload: {},
      dedupeKey: 'probe',
      scheduledAt: now,
      status: 'scheduled',
      suppressedReason: null,
      campaignId: campaign.id,
      channels: [campaign.channel],
      link: null,
      readAt: null,
      createdAt: now,
    };
  }

  preview(id: string): AudiencePreview {
    const campaign = this.get(id);
    const now = this.ctx.clock.now();
    const audience = this.audience(campaign);
    const excluded: Record<string, number> = {};
    let eligible = 0;
    let deferred = 0;
    const sample: string[] = [];
    for (const g of audience) {
      const v = this.notifications.eligibility(g, this.probe(campaign, g.id), campaign.channel, now);
      if (v.ok || v.reason === 'quiet-hours') {
        eligible++;
        if (!v.ok) deferred++;
        if (sample.length < 5) sample.push(maskName(g.name));
      } else {
        excluded[v.reason] = (excluded[v.reason] ?? 0) + 1;
      }
    }
    return { targeted: audience.length, eligible, deferred, excluded, sample };
  }

  testSend(id: string, actor: Actor): { title: string; body: string } {
    authorize(actor, 'campaign.create');
    const c = this.get(id);
    this.notifications.recordTestSend(id, actor);
    this.ctx.db.update('campaigns', id, { history: this.log(c, actor, 'test sent') });
    return template(c.templateId).render({ branch: 'Tashas' });
  }

  // ---------------------------------------------------------------- send

  sendNow(id: string, actor: Actor): Campaign {
    authorize(actor, 'campaign.send');
    const c = this.get(id);
    if (!['approved', 'scheduled'].includes(c.status)) {
      throw new DomainError('not_approved', 'Only an approved campaign can be sent.');
    }
    return this.launch(id, actor);
  }

  private launch(id: string, actor: Actor): Campaign {
    const { db, clock } = this.ctx;
    return db.transaction(() => {
      const c = this.get(id);
      const now = clock.now();
      const audience = this.audience(c);
      for (const g of audience) {
        const branch = g.homeBranchId ? this.ctx.content.branches.find((b) => b.id === g.homeBranchId)?.name ?? null : null;
        this.notifications.enqueue({
          guestId: g.id,
          templateId: c.templateId,
          data: { branch },
          dedupeKey: `campaign:${c.id}:${g.id}`,
          campaignId: c.id,
          channels: [c.channel],
          link: { screen: 'campaign', id: c.landingSlug, utm: c.utm, campaignId: c.id },
        });
      }
      const updated = db.update('campaigns', id, {
        status: 'sent',
        sentAt: now,
        stats: { ...c.stats, targeted: audience.length },
        history: this.log(c, actor, `sent to ${audience.length} guests`),
        updatedAt: now,
      });
      audit(this.ctx, actor, 'campaign.sent', 'campaign', id, { targeted: audience.length });
      return updated;
    });
  }

  /** Sends scheduled campaigns whose time has come. */
  tick(): void {
    const now = this.ctx.clock.now();
    for (const c of this.ctx.db.where('campaigns', (x) => x.status === 'scheduled' && (x.scheduledAt ?? 0) <= now)) {
      this.launch(c.id, { kind: 'system', id: 'scheduler' });
    }
  }

  /** Live report from deliveries, consents and conversions. */
  stats(id: string): CampaignStats {
    const { db } = this.ctx;
    const c = this.get(id);
    const notes = db.where('notifications', (n) => n.campaignId === id);
    const noteIds = new Set(notes.map((n) => n.id));
    const deliveries = db.where('notificationDeliveries', (d) => noteIds.has(d.notificationId));
    const recipients = new Set(notes.map((n) => n.guestId));
    const excluded: Record<string, number> = {};
    for (const d of deliveries.filter((x) => x.status === 'blocked')) {
      const r = d.lastError ?? 'blocked';
      excluded[r] = (excluded[r] ?? 0) + 1;
    }
    const optOuts = c.sentAt
      ? db.where(
          'guestConsents',
          (x) => recipients.has(x.guestId) && x.status === 'withdrawn' && x.capturedAt >= c.sentAt! && x.channel === c.channel,
        ).length
      : 0;
    const conversions = db.where(
      'outbox',
      (e) => e.payload.type === 'campaign.conversion' && e.payload.campaignId === id,
    );
    const sent = deliveries.filter((d) => d.status === 'delivered' || d.status === 'accepted').length;
    return {
      targeted: c.stats.targeted || recipients.size,
      eligible: sent + deliveries.filter((d) => d.status === 'retrying' || d.status === 'queued').length,
      excluded,
      sent,
      delivered: deliveries.filter((d) => d.status === 'delivered').length,
      failed: deliveries.filter((d) => d.status === 'failed' || d.status === 'bounced').length,
      blockedAtSend: deliveries.filter((d) => d.status === 'blocked').length,
      optOuts,
      conversions: conversions.length,
      attributedBookings: conversions.filter((e) => e.payload.type === 'campaign.conversion' && e.payload.conversionType === 'booking').length,
    };
  }

  readonly consumer: Consumer = {
    name: 'campaigns',
    handle: (event: TashasDomainEvent) => {
      if (event.type !== 'campaign.conversion') return;
      const c = this.ctx.db.get('campaigns', event.campaignId);
      if (c) this.ctx.db.update('campaigns', c.id, { stats: this.stats(c.id) });
    },
  };
}
