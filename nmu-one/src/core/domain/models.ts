/**
 * NMU ONE domain models — brief §23.
 *
 * Pure types: no React, no React Native, no I/O. They are shared by the mobile
 * app, the adapters and the admin console, and they describe what the
 * experience layer needs — not the schema of any NMU specialist system. Each
 * live adapter maps its source system into these shapes.
 */

// ── Identity ────────────────────────────────────────────────────────────────

export type Role = 'student' | 'staff' | 'parent' | 'alumni';
export const ROLES: readonly Role[] = ['student', 'staff', 'parent', 'alumni'];

/** Student → Graduate → Alumni (brief §14). One identity throughout. */
export type LifecycleStage = 'student' | 'graduate' | 'alumni' | 'staff' | 'guardian';

export type CampusId = 'south' | 'north' | 'second-avenue' | 'missionvale' | 'george';

export interface User {
  id: string;
  givenName: string;
  familyName: string;
  /** Roles the identity provider asserts for this person. */
  roles: Role[];
  lifecycle: LifecycleStage;
  homeCampus: CampusId;
  email: string;
}

export interface StudentProfile {
  userId: string;
  studentNumber: string;
  faculty: string;
  qualification: string;
  yearOfStudy: number;
  finalYear: boolean;
  /** Set once the qualification is conferred; drives the alumni transition. */
  graduation: { eligible: boolean; ceremony: string | null; venue: string | null };
}

export interface StaffProfile {
  userId: string;
  staffNumber: string;
  title: string;
  department: string;
  office: RoomRef;
}

/** What a student has chosen to share with a parent or guardian (brief §3). */
export type SharingScope = 'key-dates' | 'fees' | 'results' | 'residence' | 'wellbeing-alerts';

export interface LinkedStudent {
  studentId: string;
  givenName: string;
  relationship: 'parent' | 'guardian' | 'sponsor';
  qualification: string;
  /** Scopes the student has granted. Anything absent is not visible. */
  sharing: SharingScope[];
  sharingUpdatedAt: string;
}

export interface ParentProfile {
  userId: string;
  linkedStudents: LinkedStudent[];
}

export interface AlumniProfile {
  userId: string;
  graduationYear: number;
  qualification: string;
  industry: string | null;
  expertise: string[];
  mentorStatus: 'not-mentor' | 'invited' | 'active';
  chapter: string | null;
  profileCompleteness: number;
}

// ── Places ──────────────────────────────────────────────────────────────────

export interface RoomRef {
  code: string;
  buildingId: string;
  floor: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  campus: CampusId;
  /** Position on the schematic campus map (0–1000 × 0–1300 view box). */
  position: MapPoint;
  size: { w: number; h: number };
  entrance: string;
  floors: number;
  facilities: string[];
  accessibility: string;
  kind: 'academic' | 'library' | 'food' | 'residence' | 'support' | 'transport' | 'hall';
}

export interface Waypoint {
  id: string;
  point: MapPoint;
  label?: string;
}

export interface CampusMap {
  campus: CampusId;
  name: string;
  buildings: Building[];
  waypoints: Waypoint[];
  /** Walkable segments between waypoints. */
  paths: [string, string][];
  /** Where "You are here" sits when location is unavailable. */
  defaultOrigin: string;
}

export interface Route {
  from: string;
  to: string;
  points: MapPoint[];
  metres: number;
  walkingMinutes: number;
  steps: string[];
}

// ── Academics ───────────────────────────────────────────────────────────────

export interface Module {
  code: string;
  title: string;
  credits: number;
  lecturer: string;
  semester: 1 | 2 | 'year';
  /** 0–1, share of the module's scheduled work completed. */
  progress: number;
  lmsCourseId: string;
}

export type SessionKind = 'lecture' | 'tutorial' | 'practical' | 'seminar' | 'consultation';

export interface TimetableEntry {
  id: string;
  moduleCode: string;
  moduleTitle: string;
  kind: SessionKind;
  start: string;
  end: string;
  room: RoomRef;
  lecturer: string;
  status: 'scheduled' | 'moved' | 'cancelled';
  note?: string;
}

export interface Exam {
  id: string;
  moduleCode: string;
  moduleTitle: string;
  kind: 'exam' | 'test' | 'assignment';
  start: string;
  durationMinutes: number;
  venue: RoomRef | null;
  weightPercent: number;
  seat?: string;
}

export interface Result {
  id: string;
  moduleCode: string;
  moduleTitle: string;
  assessment: string;
  mark: number | null;
  status: 'final' | 'provisional' | 'pending';
  publishedAt: string | null;
}

export interface AcademicProgress {
  creditsEarned: number;
  creditsRequired: number;
  averageMark: number;
  standing: 'good' | 'monitor' | 'at-risk';
}

export interface AcademicDate {
  id: string;
  title: string;
  date: string;
  kind: 'term' | 'exam' | 'deadline' | 'holiday' | 'ceremony';
}

export interface LmsLink {
  moduleCode: string;
  label: string;
  /** null until the LMS integration is connected — shown as unavailable. */
  url: string | null;
}

// ── Money ───────────────────────────────────────────────────────────────────

export interface Money {
  /** Integer cents. Floating-point rands are never stored. */
  cents: number;
  currency: 'ZAR';
}

export interface FeeAccount {
  accountId: string;
  /** Positive = owed to the university; negative = in credit. */
  balance: Money;
  dueDate: string | null;
  status: 'current' | 'overdue' | 'settled' | 'credit';
  asAt: string;
}

export interface FeeTransaction {
  id: string;
  date: string;
  description: string;
  /** Positive = charge; negative = payment or funding credit. */
  amount: Money;
  kind: 'charge' | 'payment' | 'funding' | 'adjustment';
  reference: string;
}

export interface FundingStatus {
  provider: 'nsfas' | 'bursary' | 'loan' | 'self-funded';
  providerName: string;
  status: 'approved' | 'pending' | 'delayed' | 'not-applicable';
  headline: string;
  detail: string;
  expectedBy: string | null;
  updatedAt: string;
  allowances: { label: string; amount: Money; status: 'paid' | 'scheduled' | 'delayed' }[];
}

export type PaymentMethod = 'card' | 'instant-eft' | 'campus-wallet';

export interface PaymentIntent {
  id: string;
  amount: Money;
  method: PaymentMethod;
  purpose: 'fees' | 'order' | 'ticket' | 'donation';
  status: 'created' | 'awaiting-handoff' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: string;
}

export interface Receipt {
  id: string;
  paymentId: string;
  amount: Money;
  method: PaymentMethod;
  paidAt: string;
  reference: string;
  description: string;
}

// ── Library ─────────────────────────────────────────────────────────────────

export interface LibraryResource {
  id: string;
  title: string;
  authors: string[];
  year: number;
  kind: 'book' | 'ebook' | 'journal' | 'database';
  availability: 'available' | 'on-loan' | 'online';
  location: string | null;
  callNumber: string | null;
}

export interface StudySlot {
  start: string;
  end: string;
  available: boolean;
}

export interface StudySpace {
  id: string;
  name: string;
  buildingId: string;
  floor: number;
  capacity: number;
  features: string[];
  slots: StudySlot[];
}

export interface StudySpaceBooking {
  id: string;
  spaceId: string;
  spaceName: string;
  start: string;
  end: string;
  status: 'confirmed' | 'cancelled';
  reference: string;
}

// ── Residence ───────────────────────────────────────────────────────────────

export interface ResidenceRequest {
  id: string;
  category: 'maintenance' | 'cleaning' | 'security' | 'internet' | 'other';
  description: string;
  status: 'submitted' | 'in-progress' | 'resolved';
  createdAt: string;
  reference: string;
}

export interface Residence {
  id: string;
  name: string;
  campus: CampusId;
  buildingId: string;
  block: string;
  room: string;
  checkIn: { status: 'due' | 'complete'; date: string };
  office: { name: string; hours: string };
  requests: ResidenceRequest[];
}

// ── Transport ───────────────────────────────────────────────────────────────

export interface ShuttleStop {
  id: string;
  name: string;
  campus: CampusId;
  buildingId?: string;
}

export interface ShuttleRoute {
  id: string;
  code: string;
  name: string;
  status: 'on-time' | 'delayed' | 'disrupted' | 'not-running';
  stops: ShuttleStop[];
  frequencyMinutes: number;
  firstDeparture: string;
  lastDeparture: string;
  lateNight: boolean;
  statusNote?: string;
}

export interface ShuttleArrival {
  routeId: string;
  stopId: string;
  /** Minutes until the vehicle reaches the stop. */
  etaMinutes: number;
  /** True when the ETA is from vehicle tracking rather than the timetable. */
  live: boolean;
  departsAt: string;
}

export interface ServiceDisruption {
  id: string;
  routeId: string | null;
  title: string;
  detail: string;
  severity: 'info' | 'minor' | 'major';
  until: string | null;
}

// ── Commerce ────────────────────────────────────────────────────────────────

export type DietaryTag = 'vegetarian' | 'vegan' | 'halaal' | 'gluten-free' | 'contains-nuts';

export interface OpeningHours {
  days: string;
  open: string;
  close: string;
}

export interface Vendor {
  id: string;
  name: string;
  buildingId: string;
  campus: CampusId;
  cuisine: string;
  hours: OpeningHours[];
  isOpen: boolean;
  prepMinutes: number;
  acceptsOrders: boolean;
  pickupPoint: string;
}

export interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  price: Money;
  dietary: DietaryTag[];
  available: boolean;
  category: string;
}

export interface OrderLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: Money;
}

export type OrderStatus = 'placed' | 'preparing' | 'ready' | 'collected' | 'cancelled';

export interface Order {
  id: string;
  vendorId: string;
  vendorName: string;
  lines: OrderLine[];
  total: Money;
  status: OrderStatus;
  placedAt: string;
  readyAt: string | null;
  pickupCode: string;
  pickupPoint: string;
  paymentId: string;
}

// ── Community ───────────────────────────────────────────────────────────────

export type EventCategory = 'music' | 'careers' | 'innovation' | 'wellbeing' | 'sport' | 'learning';

export interface CampusEvent {
  id: string;
  title: string;
  category: EventCategory;
  start: string;
  end: string;
  venue: string;
  buildingId: string | null;
  campus: CampusId;
  summary: string;
  description: string;
  photo: string;
  organiser: string;
  capacity: number;
  spotsLeft: number;
  price: Money | null;
  ticketing: 'free-ticket' | 'paid-ticket' | 'open-entry';
  audience: Role[];
}

export interface Ticket {
  id: string;
  eventId: string;
  eventTitle: string;
  holder: string;
  code: string;
  issuedAt: string;
  start: string;
  venue: string;
  status: 'valid' | 'used' | 'cancelled';
}

export interface Society {
  id: string;
  name: string;
  category: string;
  members: number;
  description: string;
  meets: string;
  /** Whether the signed-in person is a member. */
  joined?: boolean;
}

// ── Communication ───────────────────────────────────────────────────────────

export type NotificationCategory =
  'safety' | 'academic' | 'money' | 'campus' | 'community' | 'alumni' | 'orders';

export type NotificationPriority = 'emergency' | 'high' | 'normal' | 'low';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  createdAt: string;
  read: boolean;
  /** Every notification should lead somewhere useful (brief §5, §11). */
  action: { label: string; href: string } | null;
  /** The authorised publisher (brief §16 "publish into their authorised areas"). */
  publisher: string;
  expiresAt: string | null;
}

// ── Services, support and safety ────────────────────────────────────────────

export type World = 'academics' | 'campus' | 'money' | 'community' | 'alumni';

export interface Service {
  id: string;
  title: string;
  summary: string;
  world: World;
  href: string;
  icon: string;
  keywords: string[];
}

export interface SafetyContact {
  id: string;
  name: string;
  description: string;
  /** null until the number is confirmed by the owning department. */
  phone: string | null;
  availability: string;
  scope: 'national' | 'campus';
  /** A number is only dialled from the app once it has been verified. */
  verified: boolean;
}

export interface WellbeingService {
  id: string;
  name: string;
  kind: 'counselling' | 'wellness' | 'academic-support' | 'food-support' | 'crisis' | 'health';
  description: string;
  access: 'book' | 'walk-in' | 'call' | 'online';
  hours: string;
  bookable: boolean;
  phone?: string;
  verified: boolean;
}

export interface LocationShare {
  id: string;
  startedAt: string;
  expiresAt: string;
  recipient: string;
  status: 'active' | 'stopped' | 'expired';
}

export interface SupportRoute {
  id: string;
  name: string;
  handles: string;
  channel: 'in-app-request' | 'walk-in' | 'email' | 'phone';
  hours: string;
  href: string | null;
}

export interface DirectoryPerson {
  id: string;
  name: string;
  title: string;
  department: string;
  office: RoomRef | null;
  consultation: string | null;
}

// ── Alumni ──────────────────────────────────────────────────────────────────

export interface MentoringOpportunity {
  id: string;
  title: string;
  menteeSummary: string;
  field: string;
  commitment: string;
  matchReason: string;
  status: 'open' | 'accepted' | 'declined';
}

export interface Job {
  id: string;
  title: string;
  organisation: string;
  location: string;
  type: 'full-time' | 'graduate-programme' | 'contract' | 'internship';
  postedAt: string;
}

export interface GivingCampaign {
  id: string;
  title: string;
  summary: string;
  impact: string;
  goal: Money;
  raised: Money;
  donors: number;
  suggested: Money[];
  allowsMonthly: boolean;
  photo: string;
}

export interface Pledge {
  id: string;
  campaignId: string;
  amount: Money;
  frequency: 'once' | 'monthly';
  createdAt: string;
  paymentId: string;
  reference: string;
}

export interface AlumniStory {
  id: string;
  name: string;
  classOf: number;
  headline: string;
}

export interface Chapter {
  id: string;
  name: string;
  members: number;
  nextMeetup: string | null;
}

// ── Governance ──────────────────────────────────────────────────────────────

export type ConsentPurpose =
  'location-sharing' | 'push-notifications' | `guardian-sharing:${SharingScope}`;

export interface ConsentRecord {
  id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  at: string;
  /** The wording version the person agreed to. */
  noticeVersion: string;
}

export type AuditType =
  | 'auth.sign-in'
  | 'auth.sign-out'
  | 'auth.session-expired'
  | 'role.switch'
  | 'lifecycle.transition'
  | 'consent.change'
  | 'safety.location-share.start'
  | 'safety.location-share.stop'
  | 'finance.payment'
  | 'guardian.view'
  | 'access.denied';

export interface AuditEvent {
  id: string;
  type: AuditType;
  at: string;
  actorId: string;
  detail: string;
}

// ── Assistant ───────────────────────────────────────────────────────────────

export interface KnowledgeArticle {
  id: string;
  title: string;
  body: string;
  /** The approving owner, shown with every answer (brief §6). */
  source: string;
  updatedAt: string;
  keywords: string[];
  action: { label: string; href: string } | null;
  roles: Role[];
}
