import type { LifecycleStage, Role, SharingScope } from '../domain/models';

/**
 * Centralised permissions — brief §24 "role-based access control" and §28
 * "centralise permissions".
 *
 * Every screen, adapter call and assistant answer asks `can()` the same
 * question, so a role's reach is decided here and nowhere else. The admin
 * console renders this exact matrix on its Roles page.
 */

export const CAPABILITIES = [
  'academics.timetable',
  'academics.exams',
  'academics.results',
  'academics.modules',
  'academics.calendar',
  'teaching.schedule',
  'finance.view',
  'finance.pay',
  'funding.view',
  'library.search',
  'library.book',
  'transport.view',
  'residence.view',
  'residence.request',
  'dining.view',
  'commerce.order',
  'events.view',
  'events.book',
  'societies.join',
  'safety.view',
  'safety.share-location',
  'wellbeing.view',
  'wellbeing.book',
  'campus.map',
  'directory.view',
  'guardian.linked-student',
  'guardian.key-dates',
  'guardian.fees',
  'guardian.results',
  'guardian.residence',
  'alumni.profile',
  'alumni.mentoring',
  'alumni.jobs',
  'alumni.giving',
  'lifecycle.graduate',
  'id.digital',
  'notifications.view',
  'search.assistant',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  'academics.timetable': 'Timetable',
  'academics.exams': 'Exams & assessments',
  'academics.results': 'Results',
  'academics.modules': 'Modules & LMS',
  'academics.calendar': 'Academic calendar',
  'teaching.schedule': 'Teaching schedule',
  'finance.view': 'Fees & statement',
  'finance.pay': 'Make payments',
  'funding.view': 'Funding status',
  'library.search': 'Library search',
  'library.book': 'Study-space booking',
  'transport.view': 'Shuttle',
  'residence.view': 'Residence',
  'residence.request': 'Residence requests',
  'dining.view': 'Dining',
  'commerce.order': 'Campus ordering',
  'events.view': 'Events',
  'events.book': 'Event tickets',
  'societies.join': 'Societies',
  'safety.view': 'Safety',
  'safety.share-location': 'Location sharing',
  'wellbeing.view': 'Wellbeing',
  'wellbeing.book': 'Wellbeing bookings',
  'campus.map': 'Campus map',
  'directory.view': 'Staff directory',
  'guardian.linked-student': 'Linked student',
  'guardian.key-dates': 'Shared key dates',
  'guardian.fees': 'Shared fees',
  'guardian.results': 'Shared results',
  'guardian.residence': 'Shared residence details',
  'alumni.profile': 'Alumni profile',
  'alumni.mentoring': 'Mentoring',
  'alumni.jobs': 'Careers & jobs',
  'alumni.giving': 'Giving',
  'lifecycle.graduate': 'Graduation transition',
  'id.digital': 'Digital ID',
  'notifications.view': 'Notifications',
  'search.assistant': 'Search & assistant',
};

/** How a role holds a capability. */
export type Grant =
  | true
  /** Only with the linked student's consent for this scope (guardians). */
  | { consent: SharingScope }
  /** Only at this lifecycle stage. */
  | { lifecycle: LifecycleStage };

const EVERYONE: Partial<Record<Capability, Grant>> = {
  'safety.view': true,
  'wellbeing.view': true,
  'campus.map': true,
  'events.view': true,
  'notifications.view': true,
  'search.assistant': true,
};

export const ROLE_GRANTS: Record<Role, Partial<Record<Capability, Grant>>> = {
  student: {
    ...EVERYONE,
    'academics.timetable': true,
    'academics.exams': true,
    'academics.results': true,
    'academics.modules': true,
    'academics.calendar': true,
    'finance.view': true,
    'finance.pay': true,
    'funding.view': true,
    'library.search': true,
    'library.book': true,
    'transport.view': true,
    'residence.view': true,
    'residence.request': true,
    'dining.view': true,
    'commerce.order': true,
    'events.book': true,
    'societies.join': true,
    'safety.share-location': true,
    'wellbeing.book': true,
    'directory.view': true,
    'lifecycle.graduate': { lifecycle: 'student' },
  },
  staff: {
    ...EVERYONE,
    'academics.calendar': true,
    'teaching.schedule': true,
    'library.search': true,
    'library.book': true,
    'transport.view': true,
    'dining.view': true,
    'commerce.order': true,
    'events.book': true,
    'safety.share-location': true,
    'directory.view': true,
  },
  // Brief §3: "an intentionally narrower experience with approved permissions".
  // Nothing about the student is visible without the student's own grant.
  parent: {
    ...EVERYONE,
    // The public academic calendar is general information; everything about
    // the student is a guardian capability that needs the student's grant.
    'academics.calendar': true,
    'guardian.linked-student': true,
    'guardian.key-dates': { consent: 'key-dates' },
    'guardian.fees': { consent: 'fees' },
    'guardian.results': { consent: 'results' },
    'guardian.residence': { consent: 'residence' },
  },
  alumni: {
    ...EVERYONE,
    'alumni.profile': true,
    'alumni.mentoring': true,
    'alumni.jobs': true,
    'alumni.giving': true,
    'events.book': true,
    'library.search': true,
  },
};

/**
 * Features that exist in the architecture but are not switched on until NMU
 * approves and connects the infrastructure (brief §15). `can()` refuses them
 * for everyone, and the UI shows them as unavailable rather than hiding them.
 */
export const PENDING_APPROVAL: ReadonlySet<Capability> = new Set(['id.digital']);

export interface Subject {
  role: Role;
  lifecycle: LifecycleStage;
  /** Scopes a linked student has granted this guardian. */
  consents?: readonly SharingScope[];
}

export type Decision =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'role' | 'consent' | 'lifecycle' | 'pending-approval';
      scope?: SharingScope;
    };

export function decide(subject: Subject, capability: Capability): Decision {
  if (PENDING_APPROVAL.has(capability)) return { allowed: false, reason: 'pending-approval' };
  const grant = ROLE_GRANTS[subject.role][capability];
  if (grant === undefined) return { allowed: false, reason: 'role' };
  if (grant === true) return { allowed: true };
  if ('consent' in grant) {
    return subject.consents?.includes(grant.consent)
      ? { allowed: true }
      : { allowed: false, reason: 'consent', scope: grant.consent };
  }
  return subject.lifecycle === grant.lifecycle
    ? { allowed: true }
    : { allowed: false, reason: 'lifecycle' };
}

export const can = (subject: Subject, capability: Capability): boolean =>
  decide(subject, capability).allowed;

/** Which capability guards each route prefix. Longest prefix wins. */
export const ROUTE_CAPABILITIES: Record<string, Capability> = {
  '/academics/timetable': 'academics.timetable',
  '/academics/class': 'academics.timetable',
  '/academics/exams': 'academics.exams',
  '/academics/results': 'academics.results',
  '/academics/modules': 'academics.modules',
  '/academics/calendar': 'academics.calendar',
  '/academics/teaching': 'teaching.schedule',
  '/money/funding': 'funding.view',
  '/money/pay': 'finance.pay',
  '/money': 'finance.view',
  '/library': 'library.search',
  '/transport': 'transport.view',
  '/residence/request': 'residence.request',
  '/residence': 'residence.view',
  '/dining/cart': 'commerce.order',
  '/dining/order': 'commerce.order',
  '/dining': 'dining.view',
  '/events/ticket': 'events.book',
  '/events': 'events.view',
  '/societies': 'events.view',
  '/safety': 'safety.view',
  '/wellbeing': 'wellbeing.view',
  '/campus-map': 'campus.map',
  '/directory': 'directory.view',
  '/guardian/fees': 'guardian.fees',
  '/guardian': 'guardian.linked-student',
  '/alumni/mentoring': 'alumni.mentoring',
  '/alumni/giving': 'alumni.giving',
  '/alumni/give': 'alumni.giving',
  '/alumni/jobs': 'alumni.jobs',
  '/alumni': 'alumni.profile',
  '/graduation': 'lifecycle.graduate',
  '/settings/digital-id': 'id.digital',
};

export function capabilityForPath(pathname: string): Capability | null {
  let best: string | null = null;
  for (const prefix of Object.keys(ROUTE_CAPABILITIES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best.length) best = prefix;
    }
  }
  return best ? ROUTE_CAPABILITIES[best]! : null;
}
