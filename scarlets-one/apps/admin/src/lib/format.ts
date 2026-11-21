import {
  formatVenueTime,
  type ContentCategory,
  type ContentKind,
  type ContentStatus,
  type Placement,
  type PlacementLabel,
  type ReportReason,
  type TranslationStatus,
} from '@scarlets/domain';
import { CONSOLE_TIME_ZONE } from './time';
import type {
  CampaignStatus,
  CaseState,
  FixtureNoticeKind,
  PushCategory,
  PushStatus,
  AuditArea,
} from './types';

/** "Sat 21 Nov 2026, 10:00 GMT": UK time with the zone named. */
export function formatDateTime(iso: string): string {
  const t = formatVenueTime(iso, CONSOLE_TIME_ZONE, 'en');
  const year = new Date(iso).getUTCFullYear();
  return `${t.date} ${year}, ${t.time} ${t.zone}`;
}

/** "21 Nov 2026" */
export function formatDate(iso: string): string {
  const t = formatVenueTime(iso, CONSOLE_TIME_ZONE, 'en');
  return `${t.day} ${t.month} ${new Date(iso).getUTCFullYear()}`;
}

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

export const translationLabels: Record<TranslationStatus, string> = {
  approved: 'Welsh approved',
  draft: 'Welsh draft',
  missing: 'Welsh missing',
};

export const categoryLabels: Record<ContentCategory, string> = {
  first_team: 'First team',
  women: 'Women',
  academy: 'Academy',
  community: 'Community',
  history: 'History',
  club: 'Club',
  matchday: 'Matchday',
};

export const kindLabels: Record<ContentKind, string> = {
  news: 'News',
  feature: 'Feature',
  report: 'Match report',
  video: 'Video link',
  audio: 'Audio link',
};

export const placementNames: Record<Placement, string> = {
  home: 'Home',
  match_centre: 'Match Centre',
  matchday: 'Matchday',
  passport: 'Passport',
  fan_zone: 'Fan Zone',
  partner_world: 'Partner World',
};

/** The label a supporter sees on the tile. Every campaign carries one. */
export const placementLabelNames: Record<PlacementLabel, string> = {
  partner_feature: 'Partner feature',
  partner_offer: 'Partner offer',
  sponsored: 'Sponsored',
  official_shop: 'Official shop',
};

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
};

export const caseStateLabels: Record<CaseState, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  escalated: 'Escalated to safeguarding',
};

export const reportReasonLabels: Record<ReportReason, string> = {
  inappropriate: 'Inappropriate',
  safety: 'Safety concern',
  privacy: 'Privacy',
  spam: 'Spam',
  other: 'Other',
};

export const noticeKindLabels: Record<FixtureNoticeKind, string> = {
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  time_change: 'Kick-off time change',
  venue_change: 'Venue change',
  information: 'Information',
};

export const pushCategoryLabels: Record<PushCategory, string> = {
  service: 'Service message',
  marketing: 'Marketing',
};

export const pushStatusLabels: Record<PushStatus, string> = {
  scheduled: 'Scheduled',
  sent: 'Sent (simulated)',
  cancelled: 'Cancelled',
};

export const auditAreaLabels: Record<AuditArea, string> = {
  content: 'Content',
  fixtures: 'Fixtures',
  campaigns: 'Campaigns',
  moderation: 'Moderation',
  notifications: 'Notifications',
  roles: 'Roles',
  rewards: 'Rewards',
  system: 'System',
};

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Cut long text for a one-line audit summary. */
export function clip(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
