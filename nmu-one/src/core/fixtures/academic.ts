/**
 * SYNTHETIC DEMO DATA. Generated around the demo clock so "today" always has
 * the pitch-journey timetable (brief §26) whatever day the demo is given.
 * Module codes, lecturers and marks are invented.
 */
import type {
  AcademicDate,
  AcademicProgress,
  Exam,
  Module,
  Result,
  SessionKind,
  TimetableEntry,
} from '../domain/models';
import { addDays, sastDate, sastDayDiff, sastParts, startOfSastDay } from '../time/sast';

export const modules: Module[] = [
  {
    code: 'MKT301',
    title: 'Consumer Behaviour',
    credits: 15,
    lecturer: 'Dr Anita Pillay',
    semester: 2,
    progress: 0.82,
    lmsCourseId: 'demo-mkt301',
  },
  {
    code: 'MKT302',
    title: 'Marketing Management',
    credits: 15,
    lecturer: 'Dr Sipho Ndlovu',
    semester: 2,
    progress: 0.78,
    lmsCourseId: 'demo-mkt302',
  },
  {
    code: 'MKT304',
    title: 'Digital Media',
    credits: 15,
    lecturer: 'Ms Lerato van Wyk',
    semester: 2,
    progress: 0.74,
    lmsCourseId: 'demo-mkt304',
  },
  {
    code: 'MKT390',
    title: 'Integrated Marketing Project',
    credits: 30,
    lecturer: 'Prof. Naledi Jacobs',
    semester: 'year',
    progress: 0.66,
    lmsCourseId: 'demo-mkt390',
  },
];

const title = (code: string) => modules.find((m) => m.code === code)?.title ?? code;
const lecturer = (code: string) => modules.find((m) => m.code === code)?.lecturer ?? '';

interface Slot {
  code: string;
  kind: SessionKind;
  start: [number, number];
  end: [number, number];
  room: string;
  status?: TimetableEntry['status'];
  note?: string;
}

/** The day the pitch is told on: 08:00 done, 10:00 next, 12:00, 14:00. */
const PITCH_DAY: Slot[] = [
  { code: 'MKT301', kind: 'lecture', start: [8, 0], end: [8, 45], room: 'GB101' },
  {
    code: 'MKT302',
    kind: 'lecture',
    start: [10, 0],
    end: [10, 45],
    room: 'EB212',
    status: 'moved',
    note: 'Moved from GB204 this week',
  },
  { code: 'MKT304', kind: 'lecture', start: [12, 0], end: [12, 45], room: 'GB101' },
  { code: 'MKT390', kind: 'seminar', start: [14, 0], end: [15, 30], room: 'IHS2' },
];

const OTHER_DAYS: Slot[][] = [
  [
    { code: 'MKT302', kind: 'tutorial', start: [9, 0], end: [9, 45], room: 'GB204' },
    { code: 'MKT301', kind: 'lecture', start: [11, 0], end: [11, 45], room: 'EB212' },
  ],
  [
    { code: 'MKT304', kind: 'practical', start: [8, 30], end: [10, 0], room: 'EB118' },
    { code: 'MKT390', kind: 'consultation', start: [13, 0], end: [13, 30], room: 'EB401' },
  ],
  [
    { code: 'MKT301', kind: 'tutorial', start: [10, 0], end: [10, 45], room: 'GB204' },
    { code: 'MKT302', kind: 'lecture', start: [12, 0], end: [12, 45], room: 'EB212' },
    { code: 'MKT304', kind: 'lecture', start: [14, 0], end: [14, 45], room: 'GB101' },
  ],
  [{ code: 'MKT390', kind: 'seminar', start: [9, 30], end: [11, 0], room: 'IHS2' }],
];

const roomRef = (code: string) => {
  const building = code.replace(/\d.*$/, '').toLowerCase();
  const digits = code.replace(/^\D+/, '');
  return { code, buildingId: building === 'ihs' ? 'ih' : building, floor: Number(digits[0] ?? 0) };
};

function entriesFor(day: Date, slots: Slot[]): TimetableEntry[] {
  const p = sastParts(day);
  return slots.map((s) => ({
    id: `tt-${p.year}${p.month}${p.day}-${s.code}-${s.start[0]}`,
    moduleCode: s.code,
    moduleTitle: title(s.code),
    kind: s.kind,
    start: sastDate(p.year, p.month, p.day, s.start[0], s.start[1]).toISOString(),
    end: sastDate(p.year, p.month, p.day, s.end[0], s.end[1]).toISOString(),
    room: roomRef(s.room),
    lecturer: lecturer(s.code),
    status: s.status ?? 'scheduled',
    ...(s.note ? { note: s.note } : {}),
  }));
}

export function studentTimetable(from: Date, to: Date, now: Date): TimetableEntry[] {
  const out: TimetableEntry[] = [];
  for (let day = startOfSastDay(from); day <= to; day = addDays(day, 1)) {
    const { weekday } = sastParts(day);
    if (weekday === 0 || weekday === 6) continue;
    const slots = sastDayDiff(now, day) === 0 ? PITCH_DAY : OTHER_DAYS[weekday % OTHER_DAYS.length]!;
    out.push(...entriesFor(day, slots));
  }
  return out;
}

/** The lecturer's view: the MKT302 sessions Dr Ndlovu teaches, plus a meeting. */
export function staffTimetable(from: Date, to: Date, now: Date): TimetableEntry[] {
  return studentTimetable(from, to, now)
    .filter((e) => e.moduleCode === 'MKT302')
    .concat(
      entriesFor(startOfSastDay(now), [
        { code: 'MKT302', kind: 'consultation', start: [11, 0], end: [12, 0], room: 'EB318' },
      ]).map((e) => ({ ...e, id: `${e.id}-consult`, moduleTitle: 'Student consultation hour' })),
    )
    .filter((e) => new Date(e.start) >= startOfSastDay(from) && new Date(e.start) <= to)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function exams(now: Date): Exam[] {
  const at = (days: number, h: number, m = 0) => {
    const p = sastParts(addDays(now, days));
    return sastDate(p.year, p.month, p.day, h, m).toISOString();
  };
  return [
    {
      id: 'ex-mkt302-t2',
      moduleCode: 'MKT302',
      moduleTitle: title('MKT302'),
      kind: 'test',
      start: at(3, 14),
      durationMinutes: 90,
      venue: roomRef('EB212'),
      weightPercent: 20,
    },
    {
      id: 'ex-mkt304-portfolio',
      moduleCode: 'MKT304',
      moduleTitle: title('MKT304'),
      kind: 'assignment',
      start: at(6, 23, 59),
      durationMinutes: 0,
      venue: null,
      weightPercent: 30,
    },
    {
      id: 'ex-mkt390-pitch',
      moduleCode: 'MKT390',
      moduleTitle: title('MKT390'),
      kind: 'test',
      start: at(17, 10),
      durationMinutes: 45,
      venue: roomRef('IHS2'),
      weightPercent: 40,
    },
    {
      id: 'ex-mkt301-final',
      moduleCode: 'MKT301',
      moduleTitle: title('MKT301'),
      kind: 'exam',
      start: at(24, 9),
      durationMinutes: 180,
      venue: { code: 'MH001', buildingId: 'mh', floor: 0 },
      weightPercent: 60,
      seat: 'Published 7 days before the exam',
    },
  ];
}

export function results(now: Date): Result[] {
  const ago = (days: number) => addDays(now, -days).toISOString();
  return [
    {
      id: 'r1',
      moduleCode: 'MKT301',
      moduleTitle: title('MKT301'),
      assessment: 'Test 1',
      mark: 68,
      status: 'final',
      publishedAt: ago(21),
    },
    {
      id: 'r2',
      moduleCode: 'MKT302',
      moduleTitle: title('MKT302'),
      assessment: 'Assignment 1',
      mark: 74,
      status: 'final',
      publishedAt: ago(14),
    },
    {
      id: 'r3',
      moduleCode: 'MKT304',
      moduleTitle: title('MKT304'),
      assessment: 'Campaign brief',
      mark: 81,
      status: 'provisional',
      publishedAt: ago(3),
    },
    {
      id: 'r4',
      moduleCode: 'MKT390',
      moduleTitle: title('MKT390'),
      assessment: 'Project proposal',
      mark: null,
      status: 'pending',
      publishedAt: null,
    },
  ];
}

export const progress: AcademicProgress = {
  creditsEarned: 315,
  creditsRequired: 375,
  averageMark: 71,
  standing: 'good',
};

export function academicCalendar(now: Date): AcademicDate[] {
  const on = (days: number) => startOfSastDay(addDays(now, days)).toISOString();
  return [
    { id: 'c-lectures-end', title: 'Last day of lectures', date: on(18), kind: 'term' },
    { id: 'c-grad', title: 'Graduation — Business & Economic Sciences', date: on(9), kind: 'ceremony' },
    { id: 'c-exams', title: 'Examinations begin', date: on(21), kind: 'exam' },
    { id: 'c-portfolio', title: 'MKT304 portfolio due', date: on(6), kind: 'deadline' },
    { id: 'c-results', title: 'Final results released', date: on(52), kind: 'term' },
  ].sort((a, b) => a.date.localeCompare(b.date)) as AcademicDate[];
}
