import type {
  CampusId,
  EventCategory,
  KnowledgeArticle,
  NotificationCategory,
  NotificationPriority,
  Role,
  World,
} from '@core/domain/models';
import type { Capability } from '@core/permissions/policy';

/**
 * Operator-side models for the NMU ONE console (brief §11, §16). The person
 * using the console is an *operator* — a communications officer, a faculty
 * publisher, an approver — and what they may do is decided by
 * `lib/operators.ts`, separately from the app roles in the shared core.
 */

export type OperatorRole =
  'super-admin' | 'comms-officer' | 'faculty-publisher' | 'approver' | 'vendor-manager' | 'analyst';

export interface Operator {
  id: string;
  name: string;
  title: string;
  department: string;
  role: OperatorRole;
  /** Notification categories this operator may publish into. */
  areas: NotificationCategory[];
  /** A faculty publisher may only reach their own faculty. */
  faculty: string | null;
}

export interface Segment {
  id: string;
  name: string;
  roles: Role[];
  campuses: CampusId[] | 'all';
  faculties: string[] | 'all';
  /** Only people with a residence allocation. */
  residenceOnly: boolean;
  createdBy: string;
}

export type CampaignStatus =
  'draft' | 'pending-approval' | 'changes-requested' | 'scheduled' | 'sent' | 'withdrawn';

export interface CampaignEvent {
  at: string;
  by: string;
  action:
    | 'created'
    | 'edited'
    | 'submitted'
    | 'approved'
    | 'changes-requested'
    | 'scheduled'
    | 'sent'
    | 'withdrawn'
    | 'emergency-sent';
  note?: string;
}

export interface Campaign {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  segmentId: string;
  /** An NMU ONE route, e.g. "/money/funding". Every notice should lead somewhere. */
  deepLink: string | null;
  actionLabel: string;
  /** null = deliver as soon as it is approved. */
  sendAt: string | null;
  expiresAt: string | null;
  respectQuietHours: boolean;
  channels: { push: boolean; inApp: boolean };
  status: CampaignStatus;
  authorId: string;
  approverId: string | null;
  sentAt: string | null;
  history: CampaignEvent[];
}

export interface CampaignMetrics {
  targeted: number;
  delivered: number;
  opened: number;
  actioned: number;
}

export interface AdminEvent {
  id: string;
  title: string;
  category: EventCategory;
  start: string;
  venue: string;
  capacity: number;
  ticketing: 'free-ticket' | 'paid-ticket' | 'open-entry';
  priceRands: number | null;
  organiser: string;
  status: 'draft' | 'pending-approval' | 'published' | 'cancelled';
  ticketsIssued: number;
  checkedIn: number;
}

export interface AdminMenuItem {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
}

export interface AdminVendor {
  id: string;
  name: string;
  location: string;
  open: boolean;
  acceptingOrders: boolean;
  ordersToday: number;
  averagePrepMinutes: number;
  items: AdminMenuItem[];
}

export interface ServiceRecord {
  id: string;
  title: string;
  world: World;
  owner: string;
  route: string;
  capability: Capability;
  status: 'live' | 'pilot' | 'awaiting-integration';
  integration: string;
}

export interface ArticleRecord extends KnowledgeArticle {
  status: 'draft' | 'in-review' | 'approved';
  owner: string;
}

export interface ModerationItem {
  id: string;
  kind: 'event-listing' | 'marketplace-listing' | 'society-notice';
  title: string;
  excerpt: string;
  submittedBy: string;
  reason: string;
  reportedAt: string;
  status: 'open' | 'kept' | 'removed';
}

export interface AuditEntry {
  id: string;
  at: string;
  operatorId: string;
  action: string;
  target: string;
}
