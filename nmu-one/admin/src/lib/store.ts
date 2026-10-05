'use client';

import { useSyncExternalStore } from 'react';
import {
  canApprove,
  canPublishInto,
  allows,
  OPERATOR_ROLE_LABELS,
  type OperatorAction,
} from './operators';
import { demoDay, seed, SEED_VERSION, type ConsoleData } from './seed';
import type {
  AdminEvent,
  ArticleRecord,
  Campaign,
  CampaignEvent,
  ModerationItem,
  Operator,
  OperatorRole,
  Segment,
} from './types';
import { clock } from '@core/time/clock';

/**
 * The console's state. Demo mode keeps it in this browser (localStorage) so a
 * presenter can compose as one operator and approve as another — in a second
 * tab, too, since tabs sync through the `storage` event. Live mode would put
 * the same actions behind the BFF; every one of them is permission-checked
 * here first and leaves an audit entry (brief §24).
 */

const KEY = 'nmu-one-console';

let data: ConsoleData | null = null;
const listeners = new Set<() => void>();
let announcement = { id: 0, text: '' };

function load(): ConsoleData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ConsoleData;
      // Keep a demo for its day; a new demo day starts from fresh seed data.
      if (parsed.version === SEED_VERSION && parsed.day === demoDay(clock.now())) return parsed;
    }
  } catch {
    // Private windows and blocked storage fall back to a fresh demo.
  }
  return seed(clock.now());
}

function persist(next: ConsoleData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage is a convenience; the console works without it.
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    data = load();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getData(): ConsoleData {
  if (!data) data = load();
  return data;
}

export function useConsole(): ConsoleData {
  return useSyncExternalStore(subscribe, getData, getData);
}

export function useAnnouncement() {
  return useSyncExternalStore(
    subscribe,
    () => announcement,
    () => announcement,
  );
}

/** Polite status message for screen readers and the on-screen toast. */
export function announce(text: string) {
  announcement = { id: announcement.id + 1, text };
  emit();
}

export const currentOperator = (d: ConsoleData): Operator =>
  d.operators.find((o) => o.id === d.operatorId) ?? d.operators[0]!;

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;

type Result = { ok: true; message: string } | { ok: false; message: string };

/** Apply a change as the current operator, if they're allowed; audit it. */
function commit(
  need: OperatorAction | null,
  change: (
    d: ConsoleData,
    op: Operator,
    now: Date,
  ) => { next: ConsoleData; action: string; target: string; message: string } | string,
): Result {
  const d = getData();
  const op = currentOperator(d);
  if (need && !allows(op, need)) {
    const message = 'Your role doesn’t allow that.';
    announce(message);
    return { ok: false, message };
  }
  const now = clock.now();
  const outcome = change(d, op, now);
  if (typeof outcome === 'string') {
    announce(outcome);
    return { ok: false, message: outcome };
  }
  const entry = {
    id: newId('a'),
    at: now.toISOString(),
    operatorId: op.id,
    action: outcome.action,
    target: outcome.target,
  };
  data = { ...outcome.next, audit: [entry, ...outcome.next.audit].slice(0, 500) };
  persist(data);
  announce(outcome.message);
  return { ok: true, message: outcome.message };
}

const step = (
  by: string,
  action: CampaignEvent['action'],
  now: Date,
  note?: string,
): CampaignEvent =>
  note ? { at: now.toISOString(), by, action, note } : { at: now.toISOString(), by, action };

const replace = <T extends { id: string }>(list: T[], id: string, fn: (x: T) => T) =>
  list.map((x) => (x.id === id ? fn(x) : x));

// ── Session ──────────────────────────────────────────────────────────────────

export function switchOperator(id: string) {
  const d = getData();
  const op = d.operators.find((o) => o.id === id);
  if (!op) return;
  data = { ...d, operatorId: id };
  persist(data);
  announce(`Now working as ${op.name}, ${op.title}.`);
}

export function resetDemo() {
  data = seed(clock.now());
  persist(data);
  announce('Demo data reset.');
}

// ── Notifications: create → approve → schedule → deliver → measure ───────────

export type CampaignDraft = Omit<
  Campaign,
  'id' | 'status' | 'authorId' | 'approverId' | 'sentAt' | 'history'
>;

export function validateDraft(
  draft: CampaignDraft,
  op: Operator,
  segments: Segment[],
  now: Date,
): string[] {
  const errors: string[] = [];
  if (draft.title.trim().length < 6)
    errors.push('Give the notification a title of at least 6 characters.');
  if (draft.title.length > 65)
    errors.push('Keep the title to 65 characters so it fits on a lock screen.');
  if (draft.body.trim().length < 10) errors.push('Write a message of at least 10 characters.');
  if (draft.body.length > 240) errors.push('Keep the message to 240 characters.');
  if (!canPublishInto(op, draft.category)) errors.push('You can’t publish into that category.');
  const segment = segments.find((s) => s.id === draft.segmentId);
  if (!segment) errors.push('Choose an audience.');
  if (
    segment &&
    op.faculty &&
    (segment.faculties === 'all' || segment.faculties.some((f) => f !== op.faculty))
  ) {
    errors.push(`As a faculty publisher you can only reach ${op.faculty}.`);
  }
  if (draft.priority === 'emergency')
    errors.push(
      'Emergency notices are sent from “Send an emergency notice”, not the approval queue.',
    );
  if (draft.deepLink && !draft.deepLink.startsWith('/'))
    errors.push('The link must be an NMU ONE screen, starting with “/”.');
  if (draft.deepLink && draft.actionLabel.trim().length < 3)
    errors.push('Name the button that opens the link.');
  if (draft.sendAt && new Date(draft.sendAt) <= now)
    errors.push('Choose a send time in the future, or leave it empty to send on approval.');
  if (draft.expiresAt && new Date(draft.expiresAt) <= new Date(draft.sendAt ?? now))
    errors.push('The expiry must be after the send time.');
  if (!draft.channels.push && !draft.channels.inApp) errors.push('Choose at least one channel.');
  return errors;
}

export function saveCampaign(
  draft: CampaignDraft,
  id: string | null,
  submit: boolean,
): Result & { id?: string } {
  let savedId = id;
  const r = commit('compose', (d, op, now) => {
    const errors = validateDraft(draft, op, d.segments, now);
    if (submit && errors.length) return errors[0]!;
    if (!submit && draft.title.trim().length === 0) return 'Give the draft a title before saving.';
    if (id) {
      const existing = d.campaigns.find((c) => c.id === id);
      if (!existing) return 'That notification no longer exists.';
      if (existing.authorId !== op.id && op.role !== 'super-admin')
        return 'Only the author can edit this notification.';
      if (!['draft', 'changes-requested'].includes(existing.status))
        return 'Only drafts can be edited.';
    }
    const cid = id ?? newId('cmp');
    savedId = cid;
    const history = [
      ...(id ? (d.campaigns.find((c) => c.id === id)?.history ?? []) : []),
      step(op.id, id ? 'edited' : 'created', now),
      ...(submit ? [step(op.id, 'submitted', now)] : []),
    ];
    const campaign: Campaign = {
      ...draft,
      id: cid,
      status: submit ? 'pending-approval' : 'draft',
      authorId: id ? (d.campaigns.find((c) => c.id === id)?.authorId ?? op.id) : op.id,
      approverId: null,
      sentAt: null,
      history,
    };
    const campaigns = id
      ? replace<Campaign>(d.campaigns, id, () => campaign)
      : [campaign, ...d.campaigns];
    return {
      next: { ...d, campaigns },
      action: submit ? 'Submitted for approval' : 'Saved draft',
      target: draft.title,
      message: submit
        ? `“${draft.title}” is waiting for approval.`
        : `Draft “${draft.title}” saved.`,
    };
  });
  return { ...r, id: savedId ?? undefined };
}

export function approveCampaign(id: string, note: string) {
  return commit('approve', (d, op, now) => {
    const c = d.campaigns.find((x) => x.id === id);
    if (!c) return 'That notification no longer exists.';
    const check = canApprove(op, c);
    if (!check.ok) return check.reason;
    const later = c.sendAt && new Date(c.sendAt) > now;
    const history = [
      ...c.history,
      step(op.id, 'approved', now, note || undefined),
      step(op.id, later ? 'scheduled' : 'sent', now),
    ];
    const campaigns = replace<Campaign>(d.campaigns, id, (x) => ({
      ...x,
      status: later ? 'scheduled' : 'sent',
      approverId: op.id,
      sentAt: later ? null : now.toISOString(),
      history,
    }));
    return {
      next: { ...d, campaigns },
      action: later ? 'Approved and scheduled notification' : 'Approved and sent notification',
      target: c.title,
      message: later ? `Approved. “${c.title}” is scheduled.` : `Approved and sent: “${c.title}”.`,
    };
  });
}

export function requestChanges(id: string, note: string) {
  return commit('approve', (d, op, now) => {
    const c = d.campaigns.find((x) => x.id === id);
    if (!c) return 'That notification no longer exists.';
    const check = canApprove(op, c);
    if (!check.ok) return check.reason;
    if (note.trim().length < 5) return 'Tell the author what to change.';
    const campaigns = replace<Campaign>(d.campaigns, id, (x) => ({
      ...x,
      status: 'changes-requested',
      history: [...x.history, step(op.id, 'changes-requested', now, note.trim())],
    }));
    return {
      next: { ...d, campaigns },
      action: 'Requested changes',
      target: c.title,
      message: `Sent “${c.title}” back to its author.`,
    };
  });
}

/** Deliver a scheduled notice now (the scheduler does this at `sendAt`). */
export function deliverNow(id: string) {
  return commit('approve', (d, op, now) => {
    const c = d.campaigns.find((x) => x.id === id);
    if (!c || c.status !== 'scheduled') return 'Only scheduled notifications can be sent now.';
    const campaigns = replace<Campaign>(d.campaigns, id, (x) => ({
      ...x,
      status: 'sent',
      sentAt: now.toISOString(),
      history: [...x.history, step(op.id, 'sent', now, 'Sent ahead of schedule')],
    }));
    return {
      next: { ...d, campaigns },
      action: 'Sent scheduled notification early',
      target: c.title,
      message: `Sent: “${c.title}”.`,
    };
  });
}

export function withdrawCampaign(id: string) {
  return commit(null, (d, op, now) => {
    const c = d.campaigns.find((x) => x.id === id);
    if (!c) return 'That notification no longer exists.';
    const mine = c.authorId === op.id;
    if (!mine && !allows(op, 'approve')) return 'Only the author or an approver can withdraw this.';
    if (!['draft', 'pending-approval', 'changes-requested', 'scheduled'].includes(c.status))
      return 'Sent notifications can’t be withdrawn.';
    const campaigns = replace<Campaign>(d.campaigns, id, (x) => ({
      ...x,
      status: 'withdrawn',
      history: [...x.history, step(op.id, 'withdrawn', now)],
    }));
    return {
      next: { ...d, campaigns },
      action: 'Withdrew notification',
      target: c.title,
      message: `Withdrew “${c.title}”.`,
    };
  });
}

/**
 * Emergency notices skip the queue (minutes matter) but not accountability:
 * only approvers may send them, they ignore quiet hours, and each is flagged
 * in the audit log for review afterwards.
 */
export function sendEmergency(input: {
  title: string;
  body: string;
  segmentId: string;
  deepLink: string;
  actionLabel: string;
  reason: string;
}) {
  return commit('send-emergency', (d, op, now) => {
    if (input.title.trim().length < 6 || input.body.trim().length < 10)
      return 'Write a clear title and message.';
    if (input.reason.trim().length < 5) return 'Record why this is an emergency.';
    if (!d.segments.some((s) => s.id === input.segmentId)) return 'Choose an audience.';
    const campaign: Campaign = {
      id: newId('cmp'),
      title: input.title.trim(),
      body: input.body.trim(),
      category: 'safety',
      priority: 'emergency',
      segmentId: input.segmentId,
      deepLink: input.deepLink || '/safety',
      actionLabel: input.actionLabel || 'Open Safety',
      sendAt: null,
      expiresAt: null,
      respectQuietHours: false,
      channels: { push: true, inApp: true },
      status: 'sent',
      authorId: op.id,
      approverId: op.id,
      sentAt: now.toISOString(),
      history: [step(op.id, 'emergency-sent', now, input.reason.trim())],
    };
    return {
      next: { ...d, campaigns: [campaign, ...d.campaigns] },
      action: 'EMERGENCY notice sent — review required',
      target: campaign.title,
      message: `Emergency notice sent: “${campaign.title}”.`,
    };
  });
}

/** Scheduled notices whose time has come are delivered. */
export function runScheduler() {
  const d = getData();
  const now = clock.now();
  const due = d.campaigns.filter(
    (c) => c.status === 'scheduled' && c.sendAt && new Date(c.sendAt) <= now,
  );
  if (!due.length) return;
  data = {
    ...d,
    campaigns: d.campaigns.map((c) =>
      due.includes(c)
        ? {
            ...c,
            status: 'sent',
            sentAt: c.sendAt,
            history: [...c.history, step('system', 'sent', now)],
          }
        : c,
    ),
  };
  persist(data);
  emit();
}

// ── Audiences ────────────────────────────────────────────────────────────────

export function saveSegment(input: Omit<Segment, 'id' | 'createdBy'>) {
  return commit('manage-audiences', (d, op) => {
    if (input.name.trim().length < 3) return 'Name the audience.';
    if (!input.roles.length) return 'Choose at least one group of people.';
    if (input.campuses !== 'all' && !input.campuses.length) return 'Choose at least one campus.';
    if (input.faculties !== 'all' && !input.faculties.length) return 'Choose at least one faculty.';
    const segment: Segment = {
      ...input,
      name: input.name.trim(),
      id: newId('seg'),
      createdBy: op.id,
    };
    return {
      next: { ...d, segments: [...d.segments, segment] },
      action: 'Created audience',
      target: segment.name,
      message: `Audience “${segment.name}” created.`,
    };
  });
}

// ── Events ───────────────────────────────────────────────────────────────────

export function createEvent(
  input: Omit<AdminEvent, 'id' | 'status' | 'ticketsIssued' | 'checkedIn'>,
) {
  return commit('manage-events', (d) => {
    if (input.title.trim().length < 4) return 'Give the event a title.';
    if (!input.venue.trim()) return 'Add a venue.';
    if (!(input.capacity > 0)) return 'Capacity must be more than zero.';
    if (input.ticketing === 'paid-ticket' && !(input.priceRands && input.priceRands > 0))
      return 'Set a ticket price.';
    if (new Date(input.start) <= clock.now()) return 'Choose a start time in the future.';
    const event: AdminEvent = {
      ...input,
      title: input.title.trim(),
      id: newId('evt'),
      status: 'pending-approval',
      ticketsIssued: 0,
      checkedIn: 0,
    };
    return {
      next: { ...d, events: [event, ...d.events] },
      action: 'Submitted event for approval',
      target: event.title,
      message: `“${event.title}” is waiting for approval.`,
    };
  });
}

export function setEventStatus(id: string, status: AdminEvent['status']) {
  return commit(status === 'published' ? 'approve' : 'manage-events', (d) => {
    const e = d.events.find((x) => x.id === id);
    if (!e) return 'That event no longer exists.';
    const events = replace(d.events, id, (x) => ({ ...x, status }));
    const verb =
      status === 'published'
        ? 'Published event'
        : status === 'cancelled'
          ? 'Cancelled event'
          : 'Updated event';
    return {
      next: { ...d, events },
      action: verb,
      target: e.title,
      message: `${verb}: “${e.title}”.`,
    };
  });
}

// ── Commerce ─────────────────────────────────────────────────────────────────

export function setVendor(
  id: string,
  patch: { open?: boolean; acceptingOrders?: boolean; averagePrepMinutes?: number },
) {
  return commit('manage-commerce', (d) => {
    const v = d.vendors.find((x) => x.id === id);
    if (!v) return 'That vendor no longer exists.';
    if (
      patch.averagePrepMinutes !== undefined &&
      !(patch.averagePrepMinutes >= 1 && patch.averagePrepMinutes <= 90)
    )
      return 'Preparation time must be 1–90 minutes.';
    const vendors = replace(d.vendors, id, (x) => ({ ...x, ...patch }));
    const what =
      patch.open !== undefined
        ? patch.open
          ? 'Opened'
          : 'Closed'
        : patch.acceptingOrders !== undefined
          ? patch.acceptingOrders
            ? 'Resumed orders at'
            : 'Paused orders at'
          : 'Updated preparation time for';
    return {
      next: { ...d, vendors },
      action: `${what} vendor`,
      target: v.name,
      message: `${what} ${v.name}.`,
    };
  });
}

export function setItemAvailable(vendorId: string, itemId: string, available: boolean) {
  return commit('manage-commerce', (d) => {
    const v = d.vendors.find((x) => x.id === vendorId);
    const item = v?.items.find((i) => i.id === itemId);
    if (!v || !item) return 'That item no longer exists.';
    const vendors = replace(d.vendors, vendorId, (x) => ({
      ...x,
      items: replace(x.items, itemId, (i) => ({ ...i, available })),
    }));
    const what = available ? 'Marked available' : 'Marked sold out';
    return {
      next: { ...d, vendors },
      action: what,
      target: `${item.name} (${v.name})`,
      message: `${what}: ${item.name}.`,
    };
  });
}

// ── Content ──────────────────────────────────────────────────────────────────

export function updateArticle(
  id: string,
  patch: Partial<Pick<ArticleRecord, 'title' | 'body' | 'keywords'>>,
) {
  return commit('manage-content', (d, _op, now) => {
    const a = d.articles.find((x) => x.id === id);
    if (!a) return 'That article no longer exists.';
    if (patch.title !== undefined && patch.title.trim().length < 4)
      return 'Give the article a title.';
    if (patch.body !== undefined && patch.body.trim().length < 20)
      return 'The answer needs at least 20 characters.';
    const articles = replace<ArticleRecord>(d.articles, id, (x) => ({
      ...x,
      ...patch,
      status: 'in-review',
      updatedAt: now.toISOString(),
    }));
    return {
      next: { ...d, articles },
      action: 'Edited help article (back to review)',
      target: a.title,
      message: `Saved “${patch.title ?? a.title}”. It needs owner approval again.`,
    };
  });
}

export function approveArticle(id: string) {
  return commit('approve', (d, _op, now) => {
    const a = d.articles.find((x) => x.id === id);
    if (!a) return 'That article no longer exists.';
    const articles = replace<ArticleRecord>(d.articles, id, (x) => ({
      ...x,
      status: 'approved',
      updatedAt: now.toISOString(),
    }));
    return {
      next: { ...d, articles },
      action: 'Approved help article',
      target: a.title,
      message: `Approved “${a.title}”. The assistant may now use it.`,
    };
  });
}

// ── Moderation ───────────────────────────────────────────────────────────────

export function moderate(id: string, status: ModerationItem['status']) {
  return commit('moderate', (d) => {
    const m = d.moderation.find((x) => x.id === id);
    if (!m) return 'That report no longer exists.';
    const moderation = replace(d.moderation, id, (x) => ({ ...x, status }));
    const verb = status === 'removed' ? 'Removed listing' : 'Kept listing';
    return {
      next: { ...d, moderation },
      action: verb,
      target: m.title,
      message: `${verb}: “${m.title}”.`,
    };
  });
}

// ── Roles ────────────────────────────────────────────────────────────────────

export function setOperatorRole(id: string, role: OperatorRole) {
  return commit('manage-roles', (d, op) => {
    const target = d.operators.find((o) => o.id === id);
    if (!target) return 'That operator no longer exists.';
    if (target.id === op.id) return 'You can’t change your own role — ask another administrator.';
    const operators = replace(d.operators, id, (o) => ({ ...o, role }));
    const label = OPERATOR_ROLE_LABELS[role];
    return {
      next: { ...d, operators },
      action: `Changed role to ${label}`,
      target: target.name,
      message: `${target.name} is now: ${label}.`,
    };
  });
}
