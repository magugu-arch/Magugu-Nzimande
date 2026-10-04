/**
 * Safety, wellbeing and help content.
 *
 * Brief §6 and §13: never fabricate safety procedures. So:
 *   - National emergency numbers are South Africa's published public numbers.
 *   - Campus Protection numbers are deliberately *unset* (`phone: null`,
 *     `verified: false`) until NMU Protection Services confirms them. The app
 *     shows them as "number to be confirmed" and never dials them.
 *   - Help articles describe what NMU ONE does, not university policy; each
 *     names its owner and date, and owners must approve them before launch.
 *
 * Re-verify every number below with NMU before production (RUNBOOK §Safety).
 */
import { NATIONAL_EMERGENCY } from '../../content/emergency';
import type {
  KnowledgeArticle,
  SafetyContact,
  SupportRoute,
  WellbeingService,
} from '../domain/models';

export const safetyContacts: SafetyContact[] = [
  ...NATIONAL_EMERGENCY,
  {
    id: 'cp-south',
    name: 'Campus Protection — South Campus',
    description: 'Campus security control room.',
    phone: null,
    availability: '24 hours',
    scope: 'campus',
    verified: false,
  },
  {
    id: 'cp-north',
    name: 'Campus Protection — North Campus',
    description: 'Campus security control room.',
    phone: null,
    availability: '24 hours',
    scope: 'campus',
    verified: false,
  },
];

export const wellbeingServices: WellbeingService[] = [
  {
    id: 'counselling',
    name: 'Student Counselling',
    kind: 'counselling',
    description: 'Free, confidential sessions with a registered counsellor.',
    access: 'book',
    hours: 'Weekdays 08:00–16:30',
    bookable: true,
    verified: false,
  },
  {
    id: 'academic-support',
    name: 'Academic support & tutoring',
    kind: 'academic-support',
    description: 'Study skills, writing help and module tutors.',
    access: 'book',
    hours: 'Weekdays 09:00–17:00',
    bookable: true,
    verified: false,
  },
  {
    id: 'food-support',
    name: 'Food support',
    kind: 'food-support',
    description: 'Confidential help if you are struggling to afford meals.',
    access: 'walk-in',
    hours: 'Student Help Desk, Student Centre, weekdays',
    bookable: false,
    verified: false,
  },
  {
    id: 'wellness',
    name: 'Wellness programmes',
    kind: 'wellness',
    description: 'Mindfulness, fitness and sleep sessions through the term.',
    access: 'online',
    hours: 'See Events for sessions',
    bookable: false,
    verified: false,
  },
  {
    id: 'clinic',
    name: 'Campus clinic',
    kind: 'health',
    description: 'Primary health care and referrals.',
    access: 'walk-in',
    hours: 'Health & Wellness Centre, weekdays',
    bookable: false,
    verified: false,
  },
  {
    id: 'sadag',
    name: 'SADAG Suicide Crisis Helpline',
    kind: 'crisis',
    description: 'Free, 24-hour crisis counselling from the South African Depression and Anxiety Group.',
    access: 'call',
    hours: '24 hours',
    bookable: false,
    phone: '0800 567 567',
    verified: true,
  },
];

export const supportRoutes: SupportRoute[] = [
  {
    id: 'route-finance',
    name: 'Student Finance',
    handles: 'Fees, statements and payments',
    channel: 'walk-in',
    hours: 'Administration building, weekdays',
    href: '/money',
  },
  {
    id: 'route-funding',
    name: 'Student Funding',
    handles: 'NSFAS, bursaries and allowances',
    channel: 'walk-in',
    hours: 'Administration building, weekdays',
    href: '/money/funding',
  },
  {
    id: 'route-residence',
    name: 'Residence office',
    handles: 'Maintenance, room and residence requests',
    channel: 'in-app-request',
    hours: 'Weekdays 08:00–16:00',
    href: '/residence/request',
  },
  {
    id: 'route-helpdesk',
    name: 'Student Help Desk',
    handles: 'Anything else — they will find the right person',
    channel: 'walk-in',
    hours: 'Student Centre, weekdays',
    href: '/campus-map?to=SC',
  },
];

const OWNER = 'NMU ONE Help — draft for owner approval';

export const knowledge = (updatedAt: string): KnowledgeArticle[] => [
  {
    id: 'k-study-space',
    title: 'Booking a study space',
    body: 'Library → Study spaces shows every group room and silent pod with today’s free times. Pick a free slot to book it; your booking appears under Library.',
    source: `${OWNER} (Library)`,
    updatedAt,
    keywords: ['study', 'space', 'room', 'group', 'pod', 'book', 'library', 'quiet'],
    action: { label: 'Book a study space', href: '/library?tab=spaces' },
    roles: ['student', 'staff'],
  },
  {
    id: 'k-residence',
    title: 'Residence requests',
    body: 'Residence requests are handled by your residence office. Log maintenance, cleaning, internet or security issues in Residence and track their progress there.',
    source: `${OWNER} (Residence Life)`,
    updatedAt,
    keywords: ['residence', 'res', 'request', 'maintenance', 'repair', 'room', 'broken', 'warden'],
    action: { label: 'Log a residence request', href: '/residence/request' },
    roles: ['student'],
  },
  {
    id: 'k-paying',
    title: 'Paying fees',
    body: 'Payments are made through the university’s approved payment provider. NMU ONE hands you over to it and keeps the receipt with your statement.',
    source: `${OWNER} (Student Finance)`,
    updatedAt,
    keywords: ['pay', 'payment', 'fees', 'eft', 'card'],
    action: { label: 'Go to fees', href: '/money' },
    roles: ['student'],
  },
  {
    id: 'k-unsafe',
    title: 'If you feel unsafe',
    body: 'In an emergency call 10111, or 112 from any mobile. Safety in NMU ONE lets you share your location with Campus Protection for a set time, and stop at any moment.',
    source: `${OWNER} (Protection Services)`,
    updatedAt,
    keywords: ['unsafe', 'emergency', 'danger', 'security', 'protection', 'help', 'attack', 'followed'],
    action: { label: 'Open Safety', href: '/safety' },
    roles: ['student', 'staff', 'parent', 'alumni'],
  },
  {
    id: 'k-talk',
    title: 'Talking to someone',
    body: 'Student Counselling is free and confidential — book in Wellbeing. If you are in crisis, call the SADAG Suicide Crisis Helpline on 0800 567 567, any time.',
    source: `${OWNER} (Student Wellness)`,
    updatedAt,
    keywords: ['counselling', 'counsellor', 'stress', 'anxious', 'anxiety', 'depressed', 'sad', 'talk', 'mental', 'wellbeing', 'overwhelmed'],
    action: { label: 'Open Wellbeing', href: '/wellbeing' },
    roles: ['student', 'staff', 'parent', 'alumni'],
  },
  {
    id: 'k-exam-venue',
    title: 'Finding your exam venue',
    body: 'Venues appear on each assessment in Exams as soon as they are published, with a route on the campus map.',
    source: `${OWNER} (Examinations)`,
    updatedAt,
    keywords: ['exam', 'venue', 'seat', 'test', 'where'],
    action: { label: 'View assessments', href: '/academics/exams' },
    roles: ['student'],
  },
];
