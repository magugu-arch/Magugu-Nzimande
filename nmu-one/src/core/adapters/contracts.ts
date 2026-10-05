import type {
  AcademicDate,
  AcademicProgress,
  AlumniProfile,
  AlumniStory,
  AppNotification,
  CampusEvent,
  CampusMap,
  Chapter,
  DirectoryPerson,
  Exam,
  FeeAccount,
  FeeTransaction,
  FundingStatus,
  GivingCampaign,
  Job,
  KnowledgeArticle,
  LibraryResource,
  LinkedStudent,
  LmsLink,
  LocationShare,
  MentoringOpportunity,
  MenuItem,
  Module,
  Money,
  Order,
  ParentProfile,
  PaymentIntent,
  PaymentMethod,
  Pledge,
  Receipt,
  Residence,
  ResidenceRequest,
  Result,
  Role,
  SafetyContact,
  ServiceDisruption,
  SharingScope,
  ShuttleArrival,
  ShuttleRoute,
  Society,
  StaffProfile,
  StudentProfile,
  StudySpace,
  StudySpaceBooking,
  SupportRoute,
  Ticket,
  TimetableEntry,
  User,
  Vendor,
  WellbeingService,
} from '../domain/models';

/**
 * Integration contracts — brief §22.
 *
 * NMU ONE is an experience and orchestration layer. It never talks to an NMU
 * specialist system directly: each domain is reached through one of these
 * interfaces, implemented twice —
 *
 *   mock/   synthetic, in-memory, used for the prototype and every test
 *   live.ts calls the NMU ONE backend-for-frontend (BFF), which holds the
 *           credentials and maps the real system into these shapes
 *
 * No NMU endpoint, credential or schema is assumed anywhere. The BFF routes
 * named in live.ts are NMU ONE's own contract, documented in
 * docs/INTEGRATIONS.md for whoever builds the BFF.
 *
 * Every method either resolves with domain data or rejects with an
 * `AdapterError` — never a raw transport error.
 */

// ── Identity ────────────────────────────────────────────────────────────────

/** Demo identities. Live sign-in ignores this and uses NMU SSO. */
export type PersonaId = 'student' | 'staff' | 'parent' | 'alumni';

export interface AuthSession {
  accessToken: string;
  refreshToken: string | null;
  /** ISO instant after which the session must be refreshed or re-established. */
  expiresAt: string;
  userId: string;
}

export interface SignInResult {
  session: AuthSession;
  user: User;
}

export interface AuthProvider {
  /** Demo sign-in as a synthetic persona (mock), or a session the BFF already holds (live). */
  signIn(persona?: PersonaId): Promise<SignInResult>;
  /**
   * Live sign-in: the authorization code NMU SSO returned to the app, with
   * the PKCE verifier that proves this app asked for it. The BFF exchanges
   * it with NMU SSO and returns an NMU ONE session.
   */
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<SignInResult>;
  refresh(session: AuthSession): Promise<AuthSession>;
  signOut(session: AuthSession): Promise<void>;
  getStudentProfile(userId: string): Promise<StudentProfile>;
  getStaffProfile(userId: string): Promise<StaffProfile>;
  /** Moves the same identity on to the alumni lifecycle stage (brief §14). */
  transitionToAlumni(userId: string): Promise<User>;
}

// ── Academics and learning ──────────────────────────────────────────────────

export interface AcademicProvider {
  getTimetable(range: { from: string; to: string }): Promise<TimetableEntry[]>;
  getTeachingTimetable(range: { from: string; to: string }): Promise<TimetableEntry[]>;
  getExams(): Promise<Exam[]>;
  getResults(): Promise<Result[]>;
  getProgress(): Promise<AcademicProgress>;
  getModules(): Promise<Module[]>;
  getAcademicCalendar(): Promise<AcademicDate[]>;
}

export interface LearningProvider {
  /** Deep links into the LMS for a module (brief §7 "LMS deep links"). */
  getLinks(moduleCode: string): Promise<LmsLink[]>;
}

// ── Money ───────────────────────────────────────────────────────────────────

export interface FinanceProvider {
  getAccount(): Promise<FeeAccount>;
  getTransactions(): Promise<FeeTransaction[]>;
  getFunding(): Promise<FundingStatus>;
  /** Starts an approved payment flow; the card details never touch NMU ONE. */
  createPayment(input: {
    amount: Money;
    method: PaymentMethod;
    purpose: PaymentIntent['purpose'];
    /** Where the provider's page sends the person back to, if one is used. */
    returnUrl?: string;
  }): Promise<PaymentIntent>;
  /** Completes the hand-off and returns the receipt. */
  confirmPayment(paymentId: string): Promise<Receipt>;
  getReceipt(receiptId: string): Promise<Receipt>;
}

// ── Campus ──────────────────────────────────────────────────────────────────

export interface LibraryProvider {
  search(query: string): Promise<LibraryResource[]>;
  getStudySpaces(day: string): Promise<StudySpace[]>;
  bookStudySpace(input: {
    spaceId: string;
    start: string;
    end: string;
  }): Promise<StudySpaceBooking>;
  getBookings(): Promise<StudySpaceBooking[]>;
  cancelBooking(id: string): Promise<StudySpaceBooking>;
}

export interface TransportProvider {
  getRoutes(): Promise<ShuttleRoute[]>;
  getArrivals(stopId?: string): Promise<ShuttleArrival[]>;
  getDisruptions(): Promise<ServiceDisruption[]>;
}

export interface ResidenceProvider {
  /** null when the person holds no residence allocation. */
  getResidence(): Promise<Residence | null>;
  submitRequest(input: {
    category: ResidenceRequest['category'];
    description: string;
  }): Promise<ResidenceRequest>;
}

export interface CampusProvider {
  getMap(): Promise<CampusMap>;
  getDirectory(): Promise<DirectoryPerson[]>;
}

// ── Commerce ────────────────────────────────────────────────────────────────

export interface CommerceProvider {
  getVendors(): Promise<Vendor[]>;
  getMenu(vendorId: string): Promise<MenuItem[]>;
  placeOrder(input: {
    vendorId: string;
    lines: { itemId: string; quantity: number }[];
    paymentId: string;
  }): Promise<Order>;
  getOrder(id: string): Promise<Order>;
  getOrders(): Promise<Order[]>;
}

// ── Community ───────────────────────────────────────────────────────────────

export interface CommunityProvider {
  getEvents(): Promise<CampusEvent[]>;
  getEvent(id: string): Promise<CampusEvent>;
  bookTicket(eventId: string, paymentId: string | null): Promise<Ticket>;
  getTickets(): Promise<Ticket[]>;
  getSocieties(): Promise<Society[]>;
  joinSociety(id: string): Promise<{ societyId: string; joined: boolean }>;
}

// ── Communication ───────────────────────────────────────────────────────────

export interface NotificationProvider {
  list(): Promise<AppNotification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
  /** Pushes new notifications as they are delivered. Returns an unsubscribe. */
  subscribe(listener: (n: AppNotification) => void): () => void;
  /** Registers this device's push token so the BFF can deliver notifications. */
  registerDevice(input: { token: string; platform: 'ios' | 'android' | 'web' }): Promise<void>;
}

// ── Support and safety ──────────────────────────────────────────────────────

export interface SupportProvider {
  getSafetyContacts(): Promise<SafetyContact[]>;
  getWellbeingServices(): Promise<WellbeingService[]>;
  getSupportRoutes(): Promise<SupportRoute[]>;
  /** Shares location with Campus Protection for a bounded time (brief §13). */
  startLocationShare(input: { minutes: number }): Promise<LocationShare>;
  stopLocationShare(id: string): Promise<LocationShare>;
  getKnowledge(): Promise<KnowledgeArticle[]>;
}

// ── Guardians ───────────────────────────────────────────────────────────────

export interface GuardianUpdate {
  id: string;
  studentId: string;
  scope: LinkedStudent['sharing'][number];
  title: string;
  body: string;
  at: string;
  href: string | null;
}

export interface GuardianLink {
  guardianId: string;
  name: string;
  relationship: LinkedStudent['relationship'];
  sharing: SharingScope[];
}

export interface GuardianProvider {
  getProfile(): Promise<ParentProfile>;
  /** Only updates within the scopes the student has granted. */
  getUpdates(studentId: string): Promise<GuardianUpdate[]>;
  /** A linked student's fee position — rejects `forbidden` without the 'fees' grant. */
  getStudentAccount(studentId: string): Promise<FeeAccount>;
  /** Student side: the guardians linked to me and what each can see. */
  getMyGuardians(): Promise<GuardianLink[]>;
  /** Student side: change what a guardian can see. Only the student can. */
  setGuardianSharing(guardianId: string, sharing: SharingScope[]): Promise<GuardianLink>;
}

// ── Alumni ──────────────────────────────────────────────────────────────────

export interface AlumniProvider {
  getProfile(): Promise<AlumniProfile>;
  getMentoring(): Promise<MentoringOpportunity[]>;
  respondToMentoring(id: string, accept: boolean): Promise<MentoringOpportunity>;
  getJobs(): Promise<Job[]>;
  getCampaigns(): Promise<GivingCampaign[]>;
  pledge(input: {
    campaignId: string;
    amount: Money;
    frequency: Pledge['frequency'];
    paymentId: string;
  }): Promise<Pledge>;
  getStories(): Promise<AlumniStory[]>;
  getChapters(): Promise<Chapter[]>;
}

export interface Providers {
  auth: AuthProvider;
  academic: AcademicProvider;
  learning: LearningProvider;
  finance: FinanceProvider;
  library: LibraryProvider;
  transport: TransportProvider;
  residence: ResidenceProvider;
  campus: CampusProvider;
  commerce: CommerceProvider;
  community: CommunityProvider;
  notifications: NotificationProvider;
  support: SupportProvider;
  guardian: GuardianProvider;
  alumni: AlumniProvider;
}

/** The role the adapters are acting for, set by the session. */
export interface ProviderContext {
  userId: string | null;
  role: Role | null;
}
