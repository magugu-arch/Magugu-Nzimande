import {
  allows,
  canApprove,
  canPublishInto,
  OPERATOR_ROLE_LABELS,
  type OperatorAction,
} from './operators';
import type { ConsoleData } from './seed';
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

/**
 * Every change an operator can make, as plain functions of the console's
 * data: no browser, no React. The console runs them in the browser in demo
 * mode; the BFF runs the very same functions in live mode, for the operator
 * its session identifies, so the rules (scoped publishing, separation of
 * duties, an audit entry for each change) hold on the server too (brief §16,
 * §24).
 */

export type Result =
  { ok: true; message: string; id?: string } | { ok: false; message: string; id?: undefined };

export type Performed =
  | { ok: true; message: string; id?: string; data: ConsoleData }
  | { ok: false; message: string; forbidden: boolean };

type Outcome = { next: ConsoleData; action: string; target: string; message: string; id?: string };

export type CampaignDraft = Omit<
  Campaign,
  'id' | 'status' | 'authorId' | 'approverId' | 'sentAt' | 'history'
>;

export interface EmergencyInput {
  title: string;
  body: string;
  segmentId: string;
  deepLink: string;
  actionLabel: string;
  reason: string;
}

export type NewEvent = Omit<AdminEvent, 'id' | 'status' | 'ticketsIssued' | 'checkedIn'>;
export type VendorPatch = {
  open?: boolean;
  acceptingOrders?: boolean;
  averagePrepMinutes?: number;
};
export type ArticlePatch = Partial<Pick<ArticleRecord, 'title' | 'body' | 'keywords'>>;

/** What each action takes. Plain JSON, so the same call can cross the network. */
export interface ActionArgs {
  saveCampaign: { draft: CampaignDraft; id: string | null; submit: boolean };
  approveCampaign: { id: string; note: string };
  requestChanges: { id: string; note: string };
  deliverNow: { id: string };
  withdrawCampaign: { id: string };
  sendEmergency: EmergencyInput;
  saveSegment: Omit<Segment, 'id' | 'createdBy'>;
  createEvent: NewEvent;
  setEventStatus: { id: string; status: AdminEvent['status'] };
  setVendor: { id: string; patch: VendorPatch };
  setItemAvailable: { vendorId: string; itemId: string; available: boolean };
  updateArticle: { id: string; patch: ArticlePatch };
  approveArticle: { id: string };
  moderate: { id: string; status: ModerationItem['status'] };
  setOperatorRole: { id: string; role: OperatorRole };
}
export type ActionName = keyof ActionArgs;

type NewId = (prefix: string) => string;
interface Spec<A> {
  /** The permission the action needs; null when the action checks for itself. */
  need: OperatorAction | null | ((args: A) => OperatorAction | null);
  run(d: ConsoleData, op: Operator, now: Date, args: A, newId: NewId): Outcome | string;
}

/** Unique ids for new records: time-based, with a counter for the same millisecond. */
export function idMaker(): NewId {
  let counter = 0;
  return (prefix) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;
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

export const currentOperator = (d: ConsoleData): Operator =>
  d.operators.find((o) => o.id === d.operatorId) ?? d.operators[0]!;

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

const ACTIONS: { [K in ActionName]: Spec<ActionArgs[K]> } = {
  // ── Notifications: create → approve → schedule → deliver → measure ─────────
  saveCampaign: {
    need: 'compose',
    run(d, op, now, { draft, id, submit }, newId) {
      const errors = validateDraft(draft, op, d.segments, now);
      if (submit && errors.length) return errors[0]!;
      if (!submit && draft.title.trim().length === 0)
        return 'Give the draft a title before saving.';
      const existing = id ? d.campaigns.find((c) => c.id === id) : undefined;
      if (id) {
        if (!existing) return 'That notification no longer exists.';
        if (existing.authorId !== op.id && op.role !== 'super-admin')
          return 'Only the author can edit this notification.';
        if (!['draft', 'changes-requested'].includes(existing.status))
          return 'Only drafts can be edited.';
      }
      const cid = id ?? newId('cmp');
      const campaign: Campaign = {
        ...draft,
        id: cid,
        status: submit ? 'pending-approval' : 'draft',
        authorId: existing?.authorId ?? op.id,
        approverId: null,
        sentAt: null,
        history: [
          ...(existing?.history ?? []),
          step(op.id, id ? 'edited' : 'created', now),
          ...(submit ? [step(op.id, 'submitted', now)] : []),
        ],
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
        id: cid,
      };
    },
  },

  approveCampaign: {
    need: 'approve',
    run(d, op, now, { id, note }) {
      const c = d.campaigns.find((x) => x.id === id);
      if (!c) return 'That notification no longer exists.';
      const check = canApprove(op, c);
      if (!check.ok) return check.reason;
      const later = c.sendAt && new Date(c.sendAt) > now;
      const campaigns = replace<Campaign>(d.campaigns, id, (x) => ({
        ...x,
        status: later ? 'scheduled' : 'sent',
        approverId: op.id,
        sentAt: later ? null : now.toISOString(),
        history: [
          ...c.history,
          step(op.id, 'approved', now, note || undefined),
          step(op.id, later ? 'scheduled' : 'sent', now),
        ],
      }));
      return {
        next: { ...d, campaigns },
        action: later ? 'Approved and scheduled notification' : 'Approved and sent notification',
        target: c.title,
        message: later
          ? `Approved. “${c.title}” is scheduled.`
          : `Approved and sent: “${c.title}”.`,
      };
    },
  },

  requestChanges: {
    need: 'approve',
    run(d, op, now, { id, note }) {
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
    },
  },

  /** Deliver a scheduled notice now (the scheduler does this at `sendAt`). */
  deliverNow: {
    need: 'approve',
    run(d, op, now, { id }) {
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
    },
  },

  withdrawCampaign: {
    need: null,
    run(d, op, now, { id }) {
      const c = d.campaigns.find((x) => x.id === id);
      if (!c) return 'That notification no longer exists.';
      const mine = c.authorId === op.id;
      if (!mine && !allows(op, 'approve'))
        return 'Only the author or an approver can withdraw this.';
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
    },
  },

  /**
   * Emergency notices skip the queue (minutes matter) but not accountability:
   * only approvers may send them, they ignore quiet hours, and each is flagged
   * in the audit log for review afterwards.
   */
  sendEmergency: {
    need: 'send-emergency',
    run(d, op, now, input, newId) {
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
        id: campaign.id,
      };
    },
  },

  // ── Audiences ──────────────────────────────────────────────────────────────
  saveSegment: {
    need: 'manage-audiences',
    run(d, op, _now, input, newId) {
      if (input.name.trim().length < 3) return 'Name the audience.';
      if (!input.roles.length) return 'Choose at least one group of people.';
      if (input.campuses !== 'all' && !input.campuses.length) return 'Choose at least one campus.';
      if (input.faculties !== 'all' && !input.faculties.length)
        return 'Choose at least one faculty.';
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
        id: segment.id,
      };
    },
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  createEvent: {
    need: 'manage-events',
    run(d, _op, now, input, newId) {
      if (input.title.trim().length < 4) return 'Give the event a title.';
      if (!input.venue.trim()) return 'Add a venue.';
      if (!(input.capacity > 0)) return 'Capacity must be more than zero.';
      if (input.ticketing === 'paid-ticket' && !(input.priceRands && input.priceRands > 0))
        return 'Set a ticket price.';
      if (new Date(input.start) <= now) return 'Choose a start time in the future.';
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
        id: event.id,
      };
    },
  },

  setEventStatus: {
    need: ({ status }) => (status === 'published' ? 'approve' : 'manage-events'),
    run(d, _op, _now, { id, status }) {
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
    },
  },

  // ── Commerce ───────────────────────────────────────────────────────────────
  setVendor: {
    need: 'manage-commerce',
    run(d, _op, _now, { id, patch }) {
      const v = d.vendors.find((x) => x.id === id);
      if (!v) return 'That vendor no longer exists.';
      if (
        patch.averagePrepMinutes !== undefined &&
        !(patch.averagePrepMinutes >= 1 && patch.averagePrepMinutes <= 90)
      )
        return 'Preparation time must be 1–90 minutes.';
      // Only the fields an operator may change, whatever else arrives.
      const allowed: VendorPatch = {};
      if (typeof patch.open === 'boolean') allowed.open = patch.open;
      if (typeof patch.acceptingOrders === 'boolean')
        allowed.acceptingOrders = patch.acceptingOrders;
      if (typeof patch.averagePrepMinutes === 'number')
        allowed.averagePrepMinutes = patch.averagePrepMinutes;
      const vendors = replace(d.vendors, id, (x) => ({ ...x, ...allowed }));
      const what =
        allowed.open !== undefined
          ? allowed.open
            ? 'Opened'
            : 'Closed'
          : allowed.acceptingOrders !== undefined
            ? allowed.acceptingOrders
              ? 'Resumed orders at'
              : 'Paused orders at'
            : 'Updated preparation time for';
      return {
        next: { ...d, vendors },
        action: `${what} vendor`,
        target: v.name,
        message: `${what} ${v.name}.`,
      };
    },
  },

  setItemAvailable: {
    need: 'manage-commerce',
    run(d, _op, _now, { vendorId, itemId, available }) {
      const v = d.vendors.find((x) => x.id === vendorId);
      const item = v?.items.find((i) => i.id === itemId);
      if (!v || !item) return 'That item no longer exists.';
      const vendors = replace(d.vendors, vendorId, (x) => ({
        ...x,
        items: replace(x.items, itemId, (i) => ({ ...i, available: !!available })),
      }));
      const what = available ? 'Marked available' : 'Marked sold out';
      return {
        next: { ...d, vendors },
        action: what,
        target: `${item.name} (${v.name})`,
        message: `${what}: ${item.name}.`,
      };
    },
  },

  // ── Content ────────────────────────────────────────────────────────────────
  updateArticle: {
    need: 'manage-content',
    run(d, _op, now, { id, patch }) {
      const a = d.articles.find((x) => x.id === id);
      if (!a) return 'That article no longer exists.';
      if (patch.title !== undefined && patch.title.trim().length < 4)
        return 'Give the article a title.';
      if (patch.body !== undefined && patch.body.trim().length < 20)
        return 'The answer needs at least 20 characters.';
      const allowed: ArticlePatch = {};
      if (patch.title !== undefined) allowed.title = patch.title;
      if (patch.body !== undefined) allowed.body = patch.body;
      if (patch.keywords !== undefined) allowed.keywords = patch.keywords;
      const articles = replace<ArticleRecord>(d.articles, id, (x) => ({
        ...x,
        ...allowed,
        status: 'in-review',
        updatedAt: now.toISOString(),
      }));
      return {
        next: { ...d, articles },
        action: 'Edited help article (back to review)',
        target: a.title,
        message: `Saved “${allowed.title ?? a.title}”. It needs owner approval again.`,
      };
    },
  },

  approveArticle: {
    need: 'approve',
    run(d, _op, now, { id }) {
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
    },
  },

  // ── Moderation ─────────────────────────────────────────────────────────────
  moderate: {
    need: 'moderate',
    run(d, _op, _now, { id, status }) {
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
    },
  },

  // ── Roles ──────────────────────────────────────────────────────────────────
  setOperatorRole: {
    need: 'manage-roles',
    run(d, op, _now, { id, role }) {
      const target = d.operators.find((o) => o.id === id);
      if (!target) return 'That operator no longer exists.';
      if (!(role in OPERATOR_ROLE_LABELS)) return 'That role doesn’t exist.';
      if (target.id === op.id) return 'You can’t change your own role — ask another administrator.';
      const operators = replace(d.operators, id, (o) => ({ ...o, role }));
      const label = OPERATOR_ROLE_LABELS[role];
      return {
        next: { ...d, operators },
        action: `Changed role to ${label}`,
        target: target.name,
        message: `${target.name} is now: ${label}.`,
      };
    },
  },
};

export const isActionName = (name: string): name is ActionName =>
  Object.prototype.hasOwnProperty.call(ACTIONS, name);

/**
 * Performs one action as one operator: checks their permission, runs the
 * change, and writes the audit entry. Nothing changes unless it succeeds.
 */
export function perform<K extends ActionName>(
  d: ConsoleData,
  operatorId: string,
  name: K,
  args: ActionArgs[K],
  now: Date,
  newId: NewId,
): Performed {
  const op = d.operators.find((o) => o.id === operatorId);
  const spec = ACTIONS[name] as Spec<ActionArgs[K]>;
  const need = typeof spec.need === 'function' ? spec.need(args) : spec.need;
  if (!op || (need && !allows(op, need))) {
    return { ok: false, message: 'Your role doesn’t allow that.', forbidden: true };
  }
  let outcome: Outcome | string;
  try {
    outcome = spec.run(d, op, now, args, newId);
  } catch {
    // Arguments that don't have the expected shape (only possible over the network).
    outcome = 'Some details are missing. Check the form and try again.';
  }
  if (typeof outcome === 'string') return { ok: false, message: outcome, forbidden: false };
  const entry = {
    id: newId('a'),
    at: now.toISOString(),
    operatorId: op.id,
    action: outcome.action,
    target: outcome.target,
  };
  return {
    ok: true,
    message: outcome.message,
    ...(outcome.id ? { id: outcome.id } : {}),
    data: { ...outcome.next, audit: [entry, ...outcome.next.audit].slice(0, 500) },
  };
}

/** Scheduled notices whose time has come are delivered; null when none are due. */
export function deliverDue(d: ConsoleData, now: Date): ConsoleData | null {
  const due = d.campaigns.filter(
    (c) => c.status === 'scheduled' && c.sendAt && new Date(c.sendAt) <= now,
  );
  if (!due.length) return null;
  return {
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
}
