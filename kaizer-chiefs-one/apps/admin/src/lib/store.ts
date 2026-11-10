import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  assertCan,
  can,
  campaignSchema,
  canSchedule,
  nextModerationStatus,
  PermissionError,
  type Campaign,
  type ContentStatus,
  type FanPostStatus,
  type FanReportReason,
  type ModerationAction,
  type Role,
} from '@kc-one/contracts';
import type { StaffSession } from './session';

/**
 * DEMO repository for the admin portal: an in-memory stand-in for the
 * Supabase tables, holding DEMO-labelled records only. Every method takes
 * the acting staff session and checks permissions itself, so the check sits
 * with the data, not with the button. In production the same operations run
 * against Postgres as the signed-in staff member, where RLS and the
 * moderate_fan_post / set_staff_role functions enforce them again.
 */

export interface ContentRow {
  id: string;
  title: string;
  summary: string;
  kind: 'article' | 'campaign';
  status: ContentStatus;
  publishAt: string | null;
  updatedAt: string;
  isDemo: true;
}

export interface QueueItem {
  id: string;
  imageKey: string;
  caption: string;
  author: string;
  status: FanPostStatus;
  statusReason: string | null;
  showsMinors: boolean;
  reports: { reason: FanReportReason; at: string }[];
  submittedAt: string;
  isDemo: true;
}

export interface CampaignRow extends Campaign {
  status: 'draft' | 'scheduled' | 'cancelled';
  createdBy: string;
  isDemo: true;
}

export interface AuditRow {
  id: number;
  at: string;
  actor: string;
  role: Role;
  action: string;
  entity: string;
  detail: string;
}

export interface StaffRow {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}

/**
 * `datetime-local` inputs carry no zone. Staff work in South African time
 * (UTC+2, no daylight saving), so a bare value is read as SAST, never as the
 * server's own zone.
 */
export function parseSast(value: string | null | undefined): Date | null {
  if (!value) return null;
  const bare = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
  const iso = bare ? `${value.length === 16 ? `${value}:00` : value}+02:00` : value;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const DEMO_STAFF: StaffRow[] = [
  { id: 'demo-staff-root', name: 'Demo super admin', role: 'super_admin', active: true },
  { id: 'demo-staff-content', name: 'Demo content admin', role: 'content_admin', active: true },
  { id: 'demo-staff-mod', name: 'Demo moderator', role: 'moderator', active: true },
  { id: 'demo-staff-support', name: 'Demo support agent', role: 'support_agent', active: true },
  { id: 'demo-staff-analyst', name: 'Demo analyst', role: 'analyst', active: true },
];

interface State {
  content: ContentRow[];
  queue: QueueItem[];
  campaigns: CampaignRow[];
  audit: AuditRow[];
  staff: StaffRow[];
  seq: number;
}

function seed(): State {
  const now = new Date();
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  return {
    content: [
      {
        id: 'demo-hero',
        title: 'Every Khosi matters.',
        summary: 'Home hero campaign (sample).',
        kind: 'campaign',
        status: 'published',
        publishAt: null,
        updatedAt: ago(30),
        isDemo: true,
      },
      {
        id: 'demo-matchday-guide',
        title: 'Your matchday, in one place',
        summary: 'Sample feature about the app’s matchday tools.',
        kind: 'article',
        status: 'published',
        publishAt: null,
        updatedAt: ago(26),
        isDemo: true,
      },
      {
        id: 'demo-academy',
        title: 'Where the next generation learns the game',
        summary: 'Sample academy story.',
        kind: 'article',
        status: 'draft',
        publishAt: null,
        updatedAt: ago(4),
        isDemo: true,
      },
    ],
    queue: [
      {
        id: 'demo-q-1',
        imageKey: 'supporter-portrait',
        caption: 'Sample moment · Scarves up',
        author: 'Demo supporter 1',
        status: 'pending_review',
        statusReason: null,
        showsMinors: false,
        reports: [],
        submittedAt: ago(2),
        isDemo: true,
      },
      {
        id: 'demo-q-2',
        imageKey: 'fan-cam',
        caption: 'Sample moment · On the big screen',
        author: 'Demo supporter 2',
        status: 'pending_review',
        statusReason: null,
        showsMinors: false,
        reports: [{ reason: 'privacy', at: ago(1) }],
        submittedAt: ago(3),
        isDemo: true,
      },
      {
        id: 'demo-q-3',
        imageKey: 'community',
        caption: 'Sample moment · Community day',
        author: 'Demo supporter 3',
        status: 'escalated',
        statusReason: 'Shows children: safeguarding review',
        showsMinors: true,
        reports: [],
        submittedAt: ago(5),
        isDemo: true,
      },
      {
        id: 'demo-q-4',
        imageKey: 'stadium',
        caption: 'Sample moment · Under the lights',
        author: 'Demo supporter 4',
        status: 'approved',
        statusReason: 'Meets the community rules',
        showsMinors: false,
        reports: [],
        submittedAt: ago(20),
        isDemo: true,
      },
    ],
    campaigns: [],
    audit: [],
    staff: DEMO_STAFF.map((s) => ({ ...s })),
    seq: 0,
  };
}

// One store per server process, surviving hot reloads in development.
const g = globalThis as unknown as { __kc1AdminStore?: State };
function state(): State {
  g.__kc1AdminStore ??= seed();
  return g.__kc1AdminStore;
}

/** Test helper: start from the seed again. */
export function resetStore() {
  g.__kc1AdminStore = seed();
}

function audit(
  actor: StaffSession,
  action: string,
  entity: string,
  detail: Record<string, unknown>,
) {
  const s = state();
  s.audit.unshift({
    id: ++s.seq,
    at: new Date().toISOString(),
    actor: actor.name,
    role: actor.role,
    action,
    entity,
    detail: JSON.stringify(detail),
  });
}

// --- Content -----------------------------------------------------------------

export function listContent(actor: StaffSession): ContentRow[] {
  assertCan(actor.role, 'content.read');
  return [...state().content].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createContent(
  actor: StaffSession,
  input: { title: string; summary: string; kind: 'article' | 'campaign' },
) {
  assertCan(actor.role, 'content.write');
  const title = input.title.trim();
  if (title.length < 1 || title.length > 120)
    throw new ValidationError('Titles are 1 to 120 characters.');
  if (input.summary.length > 280) throw new ValidationError('Summaries are up to 280 characters.');
  const row: ContentRow = {
    id: `demo-${randomUUID().slice(0, 8)}`,
    title,
    summary: input.summary.trim(),
    kind: input.kind,
    status: 'draft',
    publishAt: null,
    updatedAt: new Date().toISOString(),
    isDemo: true,
  };
  state().content.push(row);
  audit(actor, 'content.create', `content:${row.id}`, { title });
  return row;
}

export function setContentStatus(
  actor: StaffSession,
  id: string,
  status: ContentStatus,
  publishAt?: string | null,
) {
  // Publishing and scheduling need content.publish; drafting and archiving need content.write.
  assertCan(
    actor.role,
    status === 'published' || status === 'scheduled' ? 'content.publish' : 'content.write',
  );
  const row = state().content.find((c) => c.id === id);
  if (!row) throw new ValidationError('That item no longer exists.');
  const when = parseSast(publishAt);
  if (status === 'scheduled' && (!when || when.getTime() <= Date.now())) {
    throw new ValidationError('Choose a publish time in the future.');
  }
  const from = row.status;
  row.status = status;
  row.publishAt = status === 'scheduled' && when ? when.toISOString() : row.publishAt;
  row.updatedAt = new Date().toISOString();
  audit(actor, `content.${status}`, `content:${id}`, {
    from,
    to: status,
    publishAt: row.publishAt,
  });
}

// --- Moderation --------------------------------------------------------------

export function listQueue(actor: StaffSession): QueueItem[] {
  assertCan(actor.role, 'moderation.read');
  const order: FanPostStatus[] = [
    'escalated',
    'pending_review',
    'hidden',
    'approved',
    'rejected',
    'removed_by_user',
  ];
  return [...state().queue].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

export function moderate(
  actor: StaffSession,
  id: string,
  action: ModerationAction,
  reason: string,
) {
  const allowed =
    can(actor.role, 'moderation.act') ||
    (action === 'escalate' && can(actor.role, 'moderation.escalate'));
  if (!allowed)
    throw new PermissionError(
      action === 'escalate' ? 'moderation.escalate' : 'moderation.act',
      actor.role,
    );
  const why = reason.trim();
  if (!why) throw new ValidationError('Record a reason for every moderation decision.');
  const item = state().queue.find((q) => q.id === id);
  if (!item) throw new ValidationError('That moment no longer exists.');
  const next = nextModerationStatus(item.status, action);
  if (!next)
    throw new ValidationError(
      `You can’t ${action} a moment that is ${item.status.replace('_', ' ')}.`,
    );
  const from = item.status;
  item.status = next;
  item.statusReason = why;
  audit(actor, `fan_post.${action}`, `fan_post:${id}`, { from, to: next, reason: why });
  return next;
}

// --- Campaigns ---------------------------------------------------------------

export function listCampaigns(actor: StaffSession): CampaignRow[] {
  assertCan(actor.role, 'notifications.draft');
  return [...state().campaigns];
}

export function createCampaign(actor: StaffSession, input: Omit<Campaign, 'id' | 'scheduledFor'>) {
  assertCan(actor.role, 'notifications.draft');
  const parsed = campaignSchema.safeParse({
    ...input,
    id: `demo-c-${randomUUID().slice(0, 8)}`,
    scheduledFor: null,
  });
  if (!parsed.success)
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Check the campaign.');
  const row: CampaignRow = { ...parsed.data, status: 'draft', createdBy: actor.name, isDemo: true };
  state().campaigns.unshift(row);
  audit(actor, 'campaign.draft', `campaign:${row.id}`, {
    category: row.category,
    audience: row.audience,
  });
  return row;
}

export function scheduleCampaign(
  actor: StaffSession,
  id: string,
  when: string,
  confirmed: boolean,
) {
  assertCan(actor.role, 'notifications.schedule');
  const row = state().campaigns.find((c) => c.id === id);
  if (!row) throw new ValidationError('That campaign no longer exists.');
  if (!confirmed) throw new ValidationError('Confirm the audience and timing before scheduling.');
  const scheduledFor = parseSast(when)?.toISOString() ?? null;
  if (!canSchedule({ scheduledFor }, new Date())) {
    throw new ValidationError('Schedule at least five minutes ahead.');
  }
  row.scheduledFor = scheduledFor;
  row.status = 'scheduled';
  audit(actor, 'campaign.schedule', `campaign:${id}`, { scheduledFor, audience: row.audience });
}

export function cancelCampaign(actor: StaffSession, id: string) {
  assertCan(actor.role, 'notifications.draft');
  const row = state().campaigns.find((c) => c.id === id);
  if (!row) throw new ValidationError('That campaign no longer exists.');
  row.status = 'cancelled';
  audit(actor, 'campaign.cancel', `campaign:${id}`, {});
}

// --- Audit and staff ---------------------------------------------------------

export function listAudit(actor: StaffSession): AuditRow[] {
  assertCan(actor.role, 'audit.read');
  return [...state().audit];
}

export function listStaff(actor: StaffSession): StaffRow[] {
  assertCan(actor.role, 'roles.manage');
  return [...state().staff];
}

export function setStaffRole(actor: StaffSession, staffId: string, role: Role) {
  assertCan(actor.role, 'roles.manage');
  if (staffId === actor.sub) throw new ValidationError('You can’t change your own role.');
  const row = state().staff.find((s) => s.id === staffId);
  if (!row) throw new ValidationError('That staff member no longer exists.');
  const from = row.role;
  row.role = role;
  audit(actor, 'staff.role_set', `staff:${staffId}`, { from, to: role });
}

/** The live role for a staff id: a changed role applies on the next request. */
export function currentRole(staffId: string): Role | null {
  const row = state().staff.find((s) => s.id === staffId && s.active);
  return row?.role ?? null;
}

// --- Dashboard ---------------------------------------------------------------

export function dashboard(actor: StaffSession) {
  assertCan(actor.role, 'ops.read');
  const s = state();
  return {
    awaitingReview: s.queue.filter((q) => q.status === 'pending_review').length,
    escalated: s.queue.filter((q) => q.status === 'escalated').length,
    openReports: s.queue.reduce((n, q) => n + q.reports.length, 0),
    drafts: s.content.filter((c) => c.status === 'draft').length,
    scheduledCampaigns: s.campaigns.filter((c) => c.status === 'scheduled').length,
  };
}
