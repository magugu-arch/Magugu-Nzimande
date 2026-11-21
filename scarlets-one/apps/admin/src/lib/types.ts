import type {
  Campaign,
  ContentItem,
  LocalizedText,
  Permission,
  ReportReason,
  Role,
} from '@scarlets/domain';
import type { fixtureSeeds } from '@scarlets/adapters';

/** Whoever is performing an action. Always derived on the server, never sent by the browser. */
export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** A system account (the scheduler). It cannot sign in and its role cannot be changed. */
  system: boolean;
  demo: true;
}

export type FailureCode = 'forbidden' | 'invalid' | 'not_found' | 'conflict';

export interface Success<T> {
  ok: true;
  message: string;
  data: T;
}

export interface Failure {
  ok: false;
  code: FailureCode;
  message: string;
}

export type Result<T = undefined> = Success<T> | Failure;

/* ---------------------------------------------------------------- audit */

export const auditAreas = [
  'content',
  'fixtures',
  'campaigns',
  'moderation',
  'notifications',
  'roles',
  'rewards',
  'system',
] as const;
export type AuditArea = (typeof auditAreas)[number];

export type AuditOutcome = 'applied' | 'refused';

export interface AuditRecord {
  /** Strictly increasing. The log is append-only: records are never edited or removed. */
  seq: number;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  area: AuditArea;
  /** Dotted verb, e.g. `content.publish`. */
  action: string;
  /** The permission the action needed. Null for system housekeeping. */
  permission: Permission | null;
  entityType: string;
  entityId: string;
  entityLabel: string;
  before: string;
  after: string;
  outcome: AuditOutcome;
}

/* -------------------------------------------------------------- content */

export interface ContentRecord {
  item: ContentItem;
  updatedAt: string;
  updatedBy: string;
  /** An editor has asked a club admin to look at this draft. */
  review: { requestedBy: string; requestedAt: string } | null;
  /** The person who approved publication. Null for items seeded as published. */
  approval: { by: string; at: string } | null;
}

/* ------------------------------------------------------------- fixtures */

export const fixtureNoticeKinds = [
  'postponed',
  'cancelled',
  'time_change',
  'venue_change',
  'information',
] as const;
export type FixtureNoticeKind = (typeof fixtureNoticeKinds)[number];

/** A seeded fixture. Note what is absent: status and score belong to the match-data provider. */
export type FixtureSeed = (typeof fixtureSeeds)[number];

export interface FixtureNotice {
  kind: FixtureNoticeKind;
  text: LocalizedText;
}

export interface FixtureRecord {
  fixture: FixtureSeed;
  visible: boolean;
  notice: FixtureNotice | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/* ------------------------------------------------------------ campaigns */

export type CampaignStatus = 'draft' | 'approved';

export interface CampaignRecord {
  campaign: Campaign;
  status: CampaignStatus;
  approval: { by: string; at: string } | null;
  updatedAt: string;
  updatedBy: string;
}

/* ----------------------------------------------------------- moderation */

export type CaseState = 'pending' | 'approved' | 'rejected' | 'escalated';
export type CaseDecision = 'approve' | 'reject' | 'escalate';

interface CaseBase {
  id: string;
  state: CaseState;
  submittedAt: string;
  decision: { by: string; at: string; reason: string | null } | null;
  demo: true;
}

export interface FanCamCase extends CaseBase {
  kind: 'fan_cam';
  activityId: string;
  mediaId: string;
  caption: string | null;
  submitter: string;
  /** A photo is not accepted without all three, so a queued case always carries them. */
  consent: { ageOrGuardian: true; peopleInPhoto: true; displayAndModeration: true };
  reviewerPrompt: string | null;
}

export interface StoryReportCase extends CaseBase {
  kind: 'story_report';
  storyId: string;
  reason: ReportReason;
  note: string;
  reporter: string;
}

export type ModerationCase = FanCamCase | StoryReportCase;

/* -------------------------------------------------------- notifications */

export const segmentIds = ['following_first_team', 'season_members', 'matchday_attendees'] as const;
export type SegmentId = (typeof segmentIds)[number];

export interface Segment {
  id: SegmentId;
  label: string;
  description: string;
  /** Devices with push switched on. DEMO figure. */
  pushEnabled: number;
  /** Of those, how many gave separate marketing consent. DEMO figure. */
  marketingConsent: number;
  demo: true;
}

export const pushCategories = ['service', 'marketing'] as const;
export type PushCategory = (typeof pushCategories)[number];

export type PushStatus = 'scheduled' | 'sent' | 'cancelled';

export interface PushNotification {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  segment: SegmentId;
  category: PushCategory;
  sendAt: string;
  status: PushStatus;
  /** How many people it reaches, after the consent rule for its category. */
  recipients: number;
  createdBy: string;
  createdAt: string;
  demo: true;
}

export interface TestDelivery {
  id: string;
  /** Null when the test was sent straight from the compose form. */
  notificationId: string | null;
  device: string;
  provider: string;
  status: 'delivered_simulated';
  at: string;
  sentBy: string;
  category: PushCategory;
  en: { title: string; body: string };
  /** `fallback` is true when there was no Welsh and the device showed English. */
  cy: { title: string; body: string; fallback: boolean };
}
