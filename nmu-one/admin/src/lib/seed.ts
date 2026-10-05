/**
 * SYNTHETIC DEMO DATA for the console. Operators, audiences, campaigns,
 * metrics and moderation reports are invented. Events, vendors, menus and help
 * articles come from the same fixtures the NMU ONE app shows, so what an
 * operator changes here is recognisably what a student sees.
 */
import { events as appEvents } from '@core/fixtures/community';
import { menus, vendors as appVendors } from '@core/fixtures/campusLife';
import { knowledge } from '@core/fixtures/support';
import { addDays, addMinutes, sastDate, sastParts } from '@core/time/sast';
import type {
  AdminEvent,
  AdminVendor,
  ArticleRecord,
  AuditEntry,
  Campaign,
  ModerationItem,
  Operator,
  Segment,
  ServiceRecord,
} from './types';

/** Bump when the seed's shape changes so stored demo state is replaced. */
export const SEED_VERSION = 4;

export const FACULTIES = [
  'Business & Economic Sciences',
  'Education',
  'Engineering, Built Environment & Technology',
  'Health Sciences',
  'Humanities',
  'Law',
  'Science',
] as const;

export const OPERATORS: Operator[] = [
  {
    id: 'op-ayanda',
    name: 'Ayanda Khumalo',
    title: 'Digital communications lead',
    department: 'Communication & Marketing',
    role: 'comms-officer',
    areas: ['campus', 'community', 'academic', 'alumni'],
    faculty: null,
  },
  {
    id: 'op-pieter',
    name: 'Pieter van Wyk',
    title: 'Faculty communications officer',
    department: 'Faculty of Business & Economic Sciences',
    role: 'faculty-publisher',
    areas: ['academic', 'community'],
    faculty: 'Business & Economic Sciences',
  },
  {
    id: 'op-lindiwe',
    name: 'Lindiwe Mthembu',
    title: 'Communications approver',
    department: 'Office of the Registrar',
    role: 'approver',
    areas: [],
    faculty: null,
  },
  {
    id: 'op-farah',
    name: 'Farah Abrahams',
    title: 'Retail and commerce manager',
    department: 'Campus Services',
    role: 'vendor-manager',
    areas: ['orders'],
    faculty: null,
  },
  {
    id: 'op-kagiso',
    name: 'Kagiso Molefe',
    title: 'Insights analyst',
    department: 'Institutional Planning',
    role: 'analyst',
    areas: [],
    faculty: null,
  },
  {
    id: 'op-naledi',
    name: 'Naledi Zulu',
    title: 'NMU ONE platform owner',
    department: 'Digital Services',
    role: 'super-admin',
    areas: ['safety', 'academic', 'money', 'campus', 'community', 'alumni', 'orders'],
    faculty: null,
  },
];

export const SEGMENTS: Segment[] = [
  {
    id: 'seg-everyone',
    name: 'Everyone on NMU ONE',
    roles: ['student', 'staff', 'parent', 'alumni'],
    campuses: 'all',
    faculties: 'all',
    residenceOnly: false,
    createdBy: 'op-naledi',
  },
  {
    id: 'seg-students',
    name: 'All students',
    roles: ['student'],
    campuses: 'all',
    faculties: 'all',
    residenceOnly: false,
    createdBy: 'op-naledi',
  },
  {
    id: 'seg-south-students',
    name: 'South Campus students',
    roles: ['student'],
    campuses: ['south'],
    faculties: 'all',
    residenceOnly: false,
    createdBy: 'op-ayanda',
  },
  {
    id: 'seg-bes-students',
    name: 'Business & Economic Sciences students',
    roles: ['student'],
    campuses: 'all',
    faculties: ['Business & Economic Sciences'],
    residenceOnly: false,
    createdBy: 'op-pieter',
  },
  {
    id: 'seg-residence',
    name: 'Students in residence',
    roles: ['student'],
    campuses: 'all',
    faculties: 'all',
    residenceOnly: true,
    createdBy: 'op-ayanda',
  },
  {
    id: 'seg-alumni',
    name: 'Alumni',
    roles: ['alumni'],
    campuses: 'all',
    faculties: 'all',
    residenceOnly: false,
    createdBy: 'op-ayanda',
  },
  {
    id: 'seg-parents',
    name: 'Parents and guardians',
    roles: ['parent'],
    campuses: 'all',
    faculties: 'all',
    residenceOnly: false,
    createdBy: 'op-naledi',
  },
];

/** 08:00 SAST on the day `days` from `now`. */
const sastAt = (now: Date, days: number, h: number, m = 0) => {
  const p = sastParts(addDays(now, days));
  return sastDate(p.year, p.month, p.day, h, m).toISOString();
};

function campaigns(now: Date): Campaign[] {
  const iso = (d: Date) => d.toISOString();
  const base = {
    respectQuietHours: true,
    channels: { push: true, inApp: true },
  };
  return [
    {
      ...base,
      id: 'cmp-venue-change',
      title: 'MKT302 moves to EB212 today',
      body: 'Your 10:00 Marketing Analytics lecture is in EB212, Business & Economics Building, today only.',
      category: 'academic',
      priority: 'high',
      segmentId: 'seg-bes-students',
      deepLink: '/campus-map?to=EB212',
      actionLabel: 'Get directions',
      sendAt: null,
      expiresAt: iso(addMinutes(now, 150)),
      status: 'sent',
      authorId: 'op-pieter',
      approverId: 'op-lindiwe',
      sentAt: iso(addMinutes(now, -95)),
      history: [
        { at: iso(addMinutes(now, -140)), by: 'op-pieter', action: 'created' },
        { at: iso(addMinutes(now, -132)), by: 'op-pieter', action: 'submitted' },
        { at: iso(addMinutes(now, -96)), by: 'op-lindiwe', action: 'approved' },
        { at: iso(addMinutes(now, -95)), by: 'op-lindiwe', action: 'sent' },
      ],
    },
    {
      ...base,
      id: 'cmp-spring-sounds',
      title: 'Spring Sounds on the Lawn — tickets open',
      body: 'Five student bands, a makers’ market and food stalls. Free, but you need a ticket.',
      category: 'community',
      priority: 'normal',
      segmentId: 'seg-south-students',
      deepLink: '/events/spring-sounds',
      actionLabel: 'Get a free ticket',
      sendAt: null,
      expiresAt: sastAt(now, 3, 16),
      status: 'sent',
      authorId: 'op-ayanda',
      approverId: 'op-lindiwe',
      sentAt: iso(addDays(now, -2)),
      history: [
        { at: iso(addDays(addMinutes(now, -200), -2)), by: 'op-ayanda', action: 'created' },
        { at: iso(addDays(addMinutes(now, -180), -2)), by: 'op-ayanda', action: 'submitted' },
        { at: iso(addDays(now, -2)), by: 'op-lindiwe', action: 'approved' },
        { at: iso(addDays(now, -2)), by: 'op-lindiwe', action: 'sent' },
      ],
    },
    {
      ...base,
      id: 'cmp-mentoring',
      title: 'New mentoring circles for recent graduates',
      body: 'Alumni volunteers are opening small mentoring circles this term. Choose one that fits your field.',
      category: 'alumni',
      priority: 'normal',
      segmentId: 'seg-alumni',
      deepLink: '/alumni/mentoring',
      actionLabel: 'See mentoring',
      sendAt: null,
      expiresAt: null,
      status: 'sent',
      authorId: 'op-ayanda',
      approverId: 'op-naledi',
      sentAt: iso(addDays(now, -6)),
      history: [
        { at: iso(addDays(now, -7)), by: 'op-ayanda', action: 'created' },
        { at: iso(addDays(now, -7)), by: 'op-ayanda', action: 'submitted' },
        { at: iso(addDays(now, -6)), by: 'op-naledi', action: 'approved' },
        { at: iso(addDays(now, -6)), by: 'op-naledi', action: 'sent' },
      ],
    },
    {
      ...base,
      id: 'cmp-library-hours',
      title: 'Library open until 23:00 during exams',
      body: 'From Monday the main library stays open until 23:00 on weekdays for the exam period.',
      category: 'campus',
      priority: 'normal',
      segmentId: 'seg-students',
      deepLink: '/library',
      actionLabel: 'Book a study space',
      sendAt: sastAt(now, 1, 8),
      expiresAt: sastAt(now, 21, 0),
      status: 'pending-approval',
      authorId: 'op-ayanda',
      approverId: null,
      sentAt: null,
      history: [
        { at: iso(addMinutes(now, -50)), by: 'op-ayanda', action: 'created' },
        { at: iso(addMinutes(now, -42)), by: 'op-ayanda', action: 'submitted' },
      ],
    },
    {
      ...base,
      id: 'cmp-res-water',
      title: 'Planned water maintenance in residences',
      body: 'Water will be off in South Campus residences on Thursday from 09:00 to 12:00 for planned maintenance.',
      category: 'campus',
      priority: 'high',
      segmentId: 'seg-residence',
      deepLink: '/residence',
      actionLabel: 'Residence updates',
      sendAt: sastAt(now, 2, 7, 30),
      expiresAt: sastAt(now, 3, 12),
      status: 'scheduled',
      authorId: 'op-ayanda',
      approverId: 'op-lindiwe',
      sentAt: null,
      history: [
        { at: iso(addDays(now, -1)), by: 'op-ayanda', action: 'created' },
        { at: iso(addDays(now, -1)), by: 'op-ayanda', action: 'submitted' },
        { at: iso(addMinutes(now, -300)), by: 'op-lindiwe', action: 'approved' },
        { at: iso(addMinutes(now, -300)), by: 'op-lindiwe', action: 'scheduled' },
      ],
    },
    {
      ...base,
      id: 'cmp-careers-draft',
      title: 'Careers fair: bring your CV',
      body: 'Employers from across the Bay are on campus next week. Book a CV check before you go.',
      category: 'community',
      priority: 'low',
      segmentId: 'seg-bes-students',
      deepLink: '/events',
      actionLabel: 'See careers events',
      sendAt: null,
      expiresAt: null,
      status: 'draft',
      authorId: 'op-pieter',
      approverId: null,
      sentAt: null,
      history: [{ at: iso(addMinutes(now, -20)), by: 'op-pieter', action: 'created' }],
    },
  ];
}

function events(now: Date): AdminEvent[] {
  const fromApp: AdminEvent[] = appEvents(now).map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    start: e.start,
    venue: e.venue,
    capacity: e.capacity,
    ticketing: e.ticketing,
    priceRands: e.price ? e.price.cents / 100 : null,
    organiser: e.organiser,
    status: 'published',
    ticketsIssued: e.capacity - e.spotsLeft,
    checkedIn: 0,
  }));
  return [
    ...fromApp,
    {
      id: 'evt-debate-final',
      title: 'Inter-faculty debating final',
      category: 'learning',
      start: sastAt(now, 9, 18),
      venue: 'Main auditorium, South Campus',
      capacity: 400,
      ticketing: 'free-ticket',
      priceRands: null,
      organiser: 'Debating Society',
      status: 'pending-approval',
      ticketsIssued: 0,
      checkedIn: 0,
    },
  ];
}

function vendors(): AdminVendor[] {
  return appVendors.map((v, i) => ({
    id: v.id,
    name: v.name,
    location: v.pickupPoint,
    open: v.isOpen,
    acceptingOrders: v.acceptsOrders,
    ordersToday: [146, 211, 88, 54, 37][i % 5] ?? 40,
    averagePrepMinutes: v.prepMinutes,
    items: (menus[v.id] ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      priceCents: m.price.cents,
      available: m.available,
    })),
  }));
}

/** Operator-side metadata for the app's service directory (brief §16). */
const SERVICES: ServiceRecord[] = [
  {
    id: 'timetable',
    title: 'Timetable',
    world: 'academics',
    owner: 'Timetabling Office',
    route: '/academics/timetable',
    capability: 'academics.timetable',
    status: 'awaiting-integration',
    integration: 'Student information system',
  },
  {
    id: 'teaching',
    title: 'Teaching schedule',
    world: 'academics',
    owner: 'Timetabling Office',
    route: '/academics/teaching',
    capability: 'teaching.schedule',
    status: 'awaiting-integration',
    integration: 'Student information system',
  },
  {
    id: 'exams',
    title: 'Exams & assessments',
    world: 'academics',
    owner: 'Examinations Office',
    route: '/academics/exams',
    capability: 'academics.exams',
    status: 'awaiting-integration',
    integration: 'Student information system',
  },
  {
    id: 'results',
    title: 'Results & progress',
    world: 'academics',
    owner: 'Examinations Office',
    route: '/academics/results',
    capability: 'academics.results',
    status: 'awaiting-integration',
    integration: 'Student information system',
  },
  {
    id: 'modules',
    title: 'Modules & LMS',
    world: 'academics',
    owner: 'Learning & Teaching',
    route: '/academics/modules',
    capability: 'academics.modules',
    status: 'awaiting-integration',
    integration: 'Learning management system',
  },
  {
    id: 'calendar',
    title: 'Academic calendar',
    world: 'academics',
    owner: 'Office of the Registrar',
    route: '/academics/calendar',
    capability: 'academics.calendar',
    status: 'pilot',
    integration: 'Published calendar',
  },
  {
    id: 'map',
    title: 'Campus map',
    world: 'campus',
    owner: 'Facilities',
    route: '/campus-map',
    capability: 'campus.map',
    status: 'pilot',
    integration: 'Schematic map (mapping provider to be chosen)',
  },
  {
    id: 'shuttle',
    title: 'Shuttle',
    world: 'campus',
    owner: 'Transport Services',
    route: '/transport',
    capability: 'transport.view',
    status: 'awaiting-integration',
    integration: 'Vehicle tracking feed',
  },
  {
    id: 'library',
    title: 'Library',
    world: 'campus',
    owner: 'Library & Information Services',
    route: '/library',
    capability: 'library.search',
    status: 'awaiting-integration',
    integration: 'Library catalogue and room booking',
  },
  {
    id: 'dining',
    title: 'Food & campus shops',
    world: 'campus',
    owner: 'Campus Services',
    route: '/dining',
    capability: 'dining.view',
    status: 'pilot',
    integration: 'Vendor ordering platform',
  },
  {
    id: 'residence',
    title: 'Residence',
    world: 'campus',
    owner: 'Residence Life',
    route: '/residence',
    capability: 'residence.view',
    status: 'awaiting-integration',
    integration: 'Residence management system',
  },
  {
    id: 'directory',
    title: 'Staff directory',
    world: 'campus',
    owner: 'Human Resources',
    route: '/directory',
    capability: 'directory.view',
    status: 'awaiting-integration',
    integration: 'Staff directory',
  },
  {
    id: 'fees',
    title: 'Fees & statement',
    world: 'money',
    owner: 'Student Finance',
    route: '/money',
    capability: 'finance.view',
    status: 'awaiting-integration',
    integration: 'Finance system',
  },
  {
    id: 'funding',
    title: 'Funding status',
    world: 'money',
    owner: 'Financial Aid',
    route: '/money/funding',
    capability: 'funding.view',
    status: 'awaiting-integration',
    integration: 'Funding records',
  },
  {
    id: 'pay',
    title: 'Make a payment',
    world: 'money',
    owner: 'Student Finance',
    route: '/money/pay',
    capability: 'finance.pay',
    status: 'awaiting-integration',
    integration: 'Approved payment provider',
  },
  {
    id: 'shared-fees',
    title: 'Shared fees (parents)',
    world: 'money',
    owner: 'Student Finance',
    route: '/guardian/fees',
    capability: 'guardian.fees',
    status: 'pilot',
    integration: 'Finance system + student consent',
  },
  {
    id: 'events',
    title: 'Events',
    world: 'community',
    owner: 'Student Life',
    route: '/events',
    capability: 'events.view',
    status: 'live',
    integration: 'NMU ONE events (this console)',
  },
  {
    id: 'societies',
    title: 'Societies',
    world: 'community',
    owner: 'Student Life',
    route: '/societies',
    capability: 'events.view',
    status: 'pilot',
    integration: 'Societies register',
  },
  {
    id: 'safety',
    title: 'Safety',
    world: 'community',
    owner: 'Protection Services',
    route: '/safety',
    capability: 'safety.view',
    status: 'pilot',
    integration: 'Campus Protection numbers awaiting confirmation',
  },
  {
    id: 'wellbeing',
    title: 'Wellbeing',
    world: 'community',
    owner: 'Student Counselling',
    route: '/wellbeing',
    capability: 'wellbeing.view',
    status: 'pilot',
    integration: 'Counselling bookings',
  },
  {
    id: 'family',
    title: 'Your student (parents)',
    world: 'community',
    owner: 'Student Affairs',
    route: '/guardian',
    capability: 'guardian.linked-student',
    status: 'pilot',
    integration: 'Consent records',
  },
  {
    id: 'alumni',
    title: 'Alumni home',
    world: 'alumni',
    owner: 'Alumni Relations',
    route: '/alumni',
    capability: 'alumni.profile',
    status: 'pilot',
    integration: 'Alumni CRM',
  },
  {
    id: 'mentoring',
    title: 'Mentoring',
    world: 'alumni',
    owner: 'Alumni Relations',
    route: '/alumni/mentoring',
    capability: 'alumni.mentoring',
    status: 'pilot',
    integration: 'Alumni CRM',
  },
  {
    id: 'jobs',
    title: 'Careers & jobs',
    world: 'alumni',
    owner: 'Career Services',
    route: '/alumni/jobs',
    capability: 'alumni.jobs',
    status: 'awaiting-integration',
    integration: 'Careers portal',
  },
  {
    id: 'giving',
    title: 'Giving',
    world: 'alumni',
    owner: 'Advancement',
    route: '/alumni/giving',
    capability: 'alumni.giving',
    status: 'awaiting-integration',
    integration: 'Approved donations provider',
  },
];

function articles(now: Date): ArticleRecord[] {
  return knowledge(addDays(now, -12).toISOString()).map((a) => ({
    ...a,
    status: 'in-review',
    owner: a.source.match(/\(([^)]+)\)/)?.[1] ?? 'NMU ONE',
  }));
}

function moderation(now: Date): ModerationItem[] {
  return [
    {
      id: 'mod-1',
      kind: 'marketplace-listing',
      title: 'Selling past exam papers with memos',
      excerpt: 'All second-year accounting papers with full memos, R150 each, DM me.',
      submittedBy: 'Student account (synthetic)',
      reason: 'Reported 4 times: may breach assessment rules',
      reportedAt: addMinutes(now, -75).toISOString(),
      status: 'open',
    },
    {
      id: 'mod-2',
      kind: 'event-listing',
      title: 'Sunset beach clean-up',
      excerpt: 'Join the Environmental Society at Pollok Beach. Bags and gloves provided.',
      submittedBy: 'Environmental Society',
      reason: 'Reported once: “wrong date”',
      reportedAt: addMinutes(now, -260).toISOString(),
      status: 'open',
    },
    {
      id: 'mod-3',
      kind: 'society-notice',
      title: 'Membership fee increase',
      excerpt: 'Our annual fee goes up next term. Pay now at the old price!',
      submittedBy: 'Synthetic society',
      reason: 'Reported twice: pressure selling',
      reportedAt: addDays(now, -1).toISOString(),
      status: 'open',
    },
  ];
}

function audit(now: Date): AuditEntry[] {
  return [
    {
      id: 'a-seed-1',
      at: addMinutes(now, -95).toISOString(),
      operatorId: 'op-lindiwe',
      action: 'Approved and sent notification',
      target: 'MKT302 moves to EB212 today',
    },
    {
      id: 'a-seed-2',
      at: addMinutes(now, -42).toISOString(),
      operatorId: 'op-ayanda',
      action: 'Submitted for approval',
      target: 'Library open until 23:00 during exams',
    },
    {
      id: 'a-seed-3',
      at: addMinutes(now, -20).toISOString(),
      operatorId: 'op-pieter',
      action: 'Saved draft',
      target: 'Careers fair: bring your CV',
    },
  ].reverse();
}

export interface ConsoleData {
  version: number;
  /** The SAST date the demo was seeded for (see `demoDay`). */
  day: string;
  operatorId: string;
  operators: Operator[];
  segments: Segment[];
  campaigns: Campaign[];
  events: AdminEvent[];
  vendors: AdminVendor[];
  services: ServiceRecord[];
  articles: ArticleRecord[];
  moderation: ModerationItem[];
  audit: AuditEntry[];
}

/** "2026-10-05" — the SAST calendar day of an instant. */
export const demoDay = (now: Date) => {
  const p = sastParts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

/**
 * Seed data around `now`. The console runs on the same clock as the app
 * (`@core/time/clock`), so in scenario mode both show the same demo morning.
 */
export function seed(now: Date): ConsoleData {
  return {
    version: SEED_VERSION,
    day: demoDay(now),
    operatorId: 'op-ayanda',
    operators: OPERATORS,
    segments: SEGMENTS,
    campaigns: campaigns(now),
    events: events(now),
    vendors: vendors(),
    services: SERVICES,
    articles: articles(now),
    moderation: moderation(now),
    audit: audit(now),
  };
}
