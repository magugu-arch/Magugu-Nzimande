/**
 * SYNTHETIC DEMO DATA — events, societies, notifications, alumni and guardian
 * updates. Organisers, companies, campaigns and amounts are invented.
 */
import type { GuardianUpdate, PersonaId } from '../adapters/contracts';
import type {
  AlumniStory,
  AppNotification,
  CampusEvent,
  Chapter,
  GivingCampaign,
  Job,
  MentoringOpportunity,
  Society,
} from '../domain/models';
import { zar } from '../domain/money';
import { addDays, addMinutes, sastDate, sastParts } from '../time/sast';
import { personas } from './people';

const at = (now: Date, days: number, h: number, m = 0) => {
  const p = sastParts(addDays(now, days));
  return sastDate(p.year, p.month, p.day, h, m).toISOString();
};

/** Next Monday (or the Monday after, if today is Monday). */
const daysToMonday = (now: Date) => {
  const { weekday } = sastParts(now);
  return (8 - weekday) % 7 || 7;
};

export function events(now: Date): CampusEvent[] {
  return [
    {
      id: 'spring-sounds',
      title: 'Spring Sounds on the Lawn',
      category: 'music',
      start: at(now, 3, 16),
      end: at(now, 3, 21),
      venue: 'Main Lawn, South Campus',
      buildingId: null,
      campus: 'south',
      summary: 'Live student bands, food stalls and art on the lawn.',
      description:
        'Five student bands, a makers’ market and food stalls from campus vendors. Bring a blanket — beanbags go fast. Free, but you need a ticket so the organisers can plan safely.',
      photo: 'events',
      organiser: 'Student Life',
      capacity: 1200,
      spotsLeft: 214,
      price: null,
      ticketing: 'free-ticket',
      audience: ['student', 'staff'],
    },
    {
      id: 'innovation-market',
      title: 'Campus Innovation Marketplace',
      category: 'innovation',
      start: at(now, 1, 10),
      end: at(now, 1, 15),
      venue: 'Student Centre piazza',
      buildingId: 'sc',
      campus: 'south',
      summary: 'Shop student-made products and meet the founders behind them.',
      description:
        'Thirty student businesses selling everything from clothing to campus apps. Walk in any time — no ticket needed.',
      photo: 'campusInnovation',
      organiser: 'Innovation Hub',
      capacity: 2000,
      spotsLeft: 2000,
      price: null,
      ticketing: 'open-entry',
      audience: ['student', 'staff', 'alumni', 'parent'],
    },
    {
      id: 'data-bootcamp',
      title: 'Digital Skills Bootcamp: Data for Marketers',
      category: 'learning',
      start: at(now, 5, 13),
      end: at(now, 5, 16),
      venue: 'Innovation Hub, Studio 2',
      buildingId: 'ih',
      campus: 'south',
      summary: 'A hands-on afternoon on dashboards and campaign data.',
      description:
        'Bring a laptop. You will build a campaign dashboard from a sample dataset and leave with a certificate of attendance.',
      photo: 'digitalLearning',
      organiser: 'Faculty of Business & Economic Sciences',
      capacity: 40,
      spotsLeft: 9,
      price: null,
      ticketing: 'free-ticket',
      audience: ['student', 'alumni'],
    },
    {
      id: 'mindful-monday',
      title: 'Wellness Week: Mindful Monday',
      category: 'wellbeing',
      start: at(now, daysToMonday(now), 12, 30),
      end: at(now, daysToMonday(now), 13, 15),
      venue: 'Health & Wellness Centre',
      buildingId: 'hw',
      campus: 'south',
      summary: 'A guided 45-minute session to reset before exams.',
      description: 'A calm lunchtime session with the wellness team. Drop in; no booking needed.',
      photo: 'wellbeing',
      organiser: 'Student Wellness',
      capacity: 60,
      spotsLeft: 60,
      price: null,
      ticketing: 'open-entry',
      audience: ['student', 'staff'],
    },
    {
      id: 'alumni-careers',
      title: 'Alumni Careers Evening',
      category: 'careers',
      start: at(now, 8, 17, 30),
      end: at(now, 8, 19, 30),
      venue: 'Main Hall, South Campus',
      buildingId: 'mh',
      campus: 'south',
      summary: 'Meet alumni hiring in marketing, finance and tech.',
      description:
        'Speed-networking with alumni from twenty organisations. Final-year students and alumni welcome. Tickets include refreshments; proceeds go to the Alumni Giving Bursary.',
      photo: 'alumniMentorship',
      organiser: 'Alumni Relations',
      capacity: 300,
      spotsLeft: 58,
      price: zar(50),
      ticketing: 'paid-ticket',
      audience: ['student', 'alumni'],
    },
  ].sort((a, b) => a.start.localeCompare(b.start)) as CampusEvent[];
}

export const societies: Society[] = [
  {
    id: 'soc-marketing',
    name: 'Marketing Society',
    category: 'Academic',
    members: 412,
    description: 'Case competitions, agency visits and a portfolio night every term.',
    meets: 'Wednesdays 17:00, EB212',
  },
  {
    id: 'soc-enactus',
    name: 'Enactus',
    category: 'Entrepreneurship',
    members: 186,
    description: 'Student-led social enterprise projects with local communities.',
    meets: 'Mondays 18:00, Innovation Hub',
  },
  {
    id: 'soc-debating',
    name: 'Debating Union',
    category: 'Culture',
    members: 97,
    description: 'Weekly debates and regional tournaments.',
    meets: 'Tuesdays 18:00, GB101',
  },
  {
    id: 'soc-coding',
    name: 'Coding Club',
    category: 'Technology',
    members: 264,
    description: 'Hack nights, app projects and interview practice.',
    meets: 'Thursdays 17:30, Innovation Hub',
  },
  {
    id: 'soc-hiking',
    name: 'Hiking Club',
    category: 'Outdoors',
    members: 158,
    description: 'Weekend coastal hikes around the bay.',
    meets: 'Saturdays, Main Gate 07:00',
  },
  {
    id: 'soc-choir',
    name: 'Campus Choir',
    category: 'Music',
    members: 121,
    description: 'Rehearsals for graduation and the spring concert.',
    meets: 'Mondays 17:00, Main Hall',
  },
];

type NotificationSeed = Omit<AppNotification, 'createdAt' | 'expiresAt'> & { minutesAgo: number };

const seed = (now: Date, list: NotificationSeed[]): AppNotification[] =>
  list.map(({ minutesAgo, ...n }) => ({
    ...n,
    createdAt: addMinutes(now, -minutesAgo).toISOString(),
    expiresAt: null,
  }));

export function notificationsFor(persona: PersonaId | 'graduate', now: Date): AppNotification[] {
  switch (persona) {
    case 'student':
      return seed(now, [
        {
          id: 'n-nsfas',
          title: 'NSFAS allowance payment delayed',
          body: 'Your October living allowance has not been released yet. Tuition and accommodation are covered.',
          category: 'money',
          priority: 'high',
          read: false,
          action: { label: 'View funding status', href: '/money/funding' },
          publisher: 'Student Funding',
          minutesAgo: 38,
        },
        {
          id: 'n-room',
          title: 'MKT302 has moved to EB212 today',
          body: 'Your 10:00 Marketing Management lecture is in EB212, Business & Economics Building, level 2.',
          category: 'academic',
          priority: 'normal',
          read: false,
          action: { label: 'Show me the way', href: '/campus-map?to=EB212' },
          publisher: 'Faculty of Business & Economic Sciences',
          minutesAgo: 95,
        },
        {
          id: 'n-shuttle',
          title: 'Route B running about 5 minutes late',
          body: 'Roadworks on the way to Second Avenue. Route A is on time.',
          category: 'campus',
          priority: 'normal',
          read: false,
          action: { label: 'See shuttle times', href: '/transport' },
          publisher: 'Campus Transport',
          minutesAgo: 22,
        },
        {
          id: 'n-spring',
          title: 'Spring Sounds tickets are open',
          body: 'Free tickets for Thursday on the Main Lawn — 214 left.',
          category: 'community',
          priority: 'low',
          read: false,
          action: { label: 'Get a free ticket', href: '/events/spring-sounds' },
          publisher: 'Student Life',
          minutesAgo: 180,
        },
        {
          id: 'n-test-venue',
          title: 'MKT302 Test 2 venue confirmed',
          body: 'Test 2 is in EB212. Arrive 15 minutes early with your student card.',
          category: 'academic',
          priority: 'normal',
          read: true,
          action: { label: 'View assessments', href: '/academics/exams' },
          publisher: 'Faculty of Business & Economic Sciences',
          minutesAgo: 60 * 26,
        },
      ]);
    case 'staff':
      return seed(now, [
        {
          id: 'n-staff-marks',
          title: 'MKT302 Test 1 marks due Friday',
          body: 'Capture marks before Friday 16:00 so students see them before exams.',
          category: 'academic',
          priority: 'high',
          read: false,
          action: { label: 'Open teaching schedule', href: '/academics/teaching' },
          publisher: 'Faculty Office',
          minutesAgo: 70,
        },
        {
          id: 'n-staff-room',
          title: 'Your 10:00 lecture is in EB212 this week',
          body: 'GB204 is closed for maintenance. Students have been notified.',
          category: 'academic',
          priority: 'normal',
          read: false,
          action: { label: 'Show on map', href: '/campus-map?to=EB212' },
          publisher: 'Timetabling',
          minutesAgo: 120,
        },
        {
          id: 'n-staff-careers',
          title: 'Volunteer for the Alumni Careers Evening',
          body: 'Alumni Relations is looking for staff hosts for each industry table.',
          category: 'community',
          priority: 'low',
          read: false,
          action: { label: 'View event', href: '/events/alumni-careers' },
          publisher: 'Alumni Relations',
          minutesAgo: 300,
        },
      ]);
    case 'parent':
      return seed(now, [
        {
          id: 'n-par-grad',
          title: 'Graduation day is confirmed',
          body: 'Thandi’s ceremony details are now available in Key dates.',
          category: 'academic',
          priority: 'normal',
          read: false,
          action: { label: 'See key dates', href: '/guardian' },
          publisher: 'Registrar',
          minutesAgo: 140,
        },
        {
          id: 'n-par-fees',
          title: 'Fee statement updated',
          body: 'Thandi has shared her fee balance with you. View the current position.',
          category: 'money',
          priority: 'normal',
          read: false,
          action: { label: 'View fees', href: '/guardian/fees' },
          publisher: 'Student Finance',
          minutesAgo: 60 * 20,
        },
      ]);
    case 'alumni':
      return seed(now, [
        {
          id: 'n-alu-mentor',
          title: 'A student has asked for a mentor in your field',
          body: 'A second-year Computer Science student is looking for a product-management mentor.',
          category: 'alumni',
          priority: 'high',
          read: false,
          action: { label: 'View mentoring request', href: '/alumni/mentoring' },
          publisher: 'Alumni Relations',
          minutesAgo: 50,
        },
        {
          id: 'n-alu-reunion',
          title: 'Alumni Careers Evening — tickets open',
          body: 'Meet final-year students and fellow alumni on campus.',
          category: 'community',
          priority: 'low',
          read: false,
          action: { label: 'View event', href: '/events/alumni-careers' },
          publisher: 'Alumni Relations',
          minutesAgo: 400,
        },
      ]);
    case 'graduate':
      return seed(now, [
        {
          id: 'n-grad-welcome',
          title: 'Welcome to the NMU alumni community',
          body: 'Same sign-in, new home. Your profile, events and mentoring are ready.',
          category: 'alumni',
          priority: 'normal',
          read: false,
          action: { label: 'Complete your profile', href: '/alumni' },
          publisher: 'Alumni Relations',
          minutesAgo: 0,
        },
      ]);
  }
}

/** Delivered a short while after graduation (brief §26 step 13). */
export function mentoringNotification(now: Date): AppNotification {
  return {
    id: 'n-grad-mentor',
    title: 'Mentoring opportunity in digital marketing',
    body: 'A first-year marketing student would value 1 hour a month with a recent graduate.',
    category: 'alumni',
    priority: 'high',
    createdAt: now.toISOString(),
    read: false,
    action: { label: 'View opportunity', href: '/alumni/mentoring' },
    publisher: 'Alumni Relations',
    expiresAt: null,
  };
}

export function mentoringFor(userId: string): MentoringOpportunity[] {
  if (userId === personas.alumni.id) {
    return [
      {
        id: 'm-cs-pm',
        title: 'Mentor a Computer Science student',
        menteeSummary: 'A second-year Computer Science student exploring product management.',
        field: 'Product management',
        commitment: '1 hour a month for 6 months, online',
        matchReason: 'You studied Computer Science and list product management as expertise.',
        status: 'open',
      },
    ];
  }
  return [
    {
      id: 'm-mkt-first-year',
      title: 'Mentor a first-year marketing student',
      menteeSummary: 'A first-year BCom student from Kariega, keen on digital campaigns.',
      field: 'Digital marketing',
      commitment: '1 hour a month for 6 months, online or on campus',
      matchReason: 'You graduated in Marketing Management and list digital marketing as expertise.',
      status: 'open',
    },
  ];
}

export const jobs = (now: Date): Job[] => [
  {
    id: 'j1',
    title: 'Graduate Marketing Associate',
    organisation: 'Algoa Coastal Retail (demo)',
    location: 'Gqeberha',
    type: 'graduate-programme',
    postedAt: addDays(now, -2).toISOString(),
  },
  {
    id: 'j2',
    title: 'Junior Data Analyst',
    organisation: 'Bayview Analytics (demo)',
    location: 'Hybrid · Gqeberha',
    type: 'full-time',
    postedAt: addDays(now, -5).toISOString(),
  },
  {
    id: 'j3',
    title: 'Brand Coordinator',
    organisation: 'Umoya Foods (demo)',
    location: 'Cape Town',
    type: 'full-time',
    postedAt: addDays(now, -6).toISOString(),
  },
  {
    id: 'j4',
    title: 'Product Management Intern',
    organisation: 'Kudu Fintech (demo)',
    location: 'Johannesburg',
    type: 'internship',
    postedAt: addDays(now, -9).toISOString(),
  },
];

export const campaigns: GivingCampaign[] = [
  {
    id: 'alumni-bursary',
    title: 'Alumni Giving Bursary',
    summary: 'Help a student who is close to finishing but short of funds.',
    impact: 'R500 covers a month of data and textbooks for one student.',
    goal: zar(2_000_000),
    raised: zar(1_240_500),
    donors: 1382,
    suggested: [zar(100), zar(250), zar(500), zar(1000)],
    allowsMonthly: true,
    photo: 'alumniGiving',
  },
  {
    id: 'food-support',
    title: 'Student Food Support Fund',
    summary: 'Meals for students facing food insecurity during exams.',
    impact: 'R150 funds a week of lunches at Campus Kitchen.',
    goal: zar(500_000),
    raised: zar(318_200),
    donors: 904,
    suggested: [zar(50), zar(150), zar(300)],
    allowsMonthly: true,
    photo: 'cafeteria',
  },
];

export const stories: AlumniStory[] = [
  {
    id: 's1',
    name: 'Zanele M.',
    classOf: 2017,
    headline: 'From campus marketplace stall to a 40-person agency',
  },
  {
    id: 's2',
    name: 'Ruan P.',
    classOf: 2012,
    headline: 'Building ocean-data tools for coastal cities',
  },
  {
    id: 's3',
    name: 'Aisha K.',
    classOf: 2020,
    headline: 'Mentoring 12 first-generation students this year',
  },
];

export const chapters = (now: Date): Chapter[] => [
  {
    id: 'ch-nmb',
    name: 'Nelson Mandela Bay Chapter',
    members: 4210,
    nextMeetup: addDays(now, 12).toISOString(),
  },
  {
    id: 'ch-gp',
    name: 'Gauteng Chapter',
    members: 6120,
    nextMeetup: addDays(now, 19).toISOString(),
  },
  { id: 'ch-wc', name: 'Western Cape Chapter', members: 3870, nextMeetup: null },
];

export function guardianUpdates(now: Date, studentId: string): GuardianUpdate[] {
  return [
    {
      id: 'g1',
      studentId,
      scope: 'key-dates',
      title: 'Graduation ceremony',
      body: 'Business & Economic Sciences ceremony, Main Hall, South Campus.',
      at: at(now, 9, 10),
      href: '/guardian',
    },
    {
      id: 'g2',
      studentId,
      scope: 'key-dates',
      title: 'Examinations begin',
      body: 'Final examinations start for the semester.',
      at: at(now, 21, 9),
      href: '/guardian',
    },
    {
      id: 'g3',
      studentId,
      scope: 'fees',
      title: 'Fee statement updated',
      body: 'A new statement is available.',
      at: addMinutes(now, -60 * 20).toISOString(),
      href: '/guardian/fees',
    },
    {
      id: 'g4',
      studentId,
      scope: 'results',
      title: 'Provisional result published',
      body: 'A provisional mark has been published.',
      at: addDays(now, -3).toISOString(),
      href: null,
    },
  ];
}
