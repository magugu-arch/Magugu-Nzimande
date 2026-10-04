import {
  answerQuestion,
  detectIntent,
  matchArticle,
  type AssistantContext,
} from '@/core/assistant/assistant';
import { AdapterError } from '@/core/adapters/errors';
import { southCampus } from '@/core/fixtures/campus';
import { studySpaces, shuttleRoutes } from '@/core/fixtures/campusLife';
import { knowledge, supportRoutes } from '@/core/fixtures/support';
import { studentTimetable, exams } from '@/core/fixtures/academic';
import { funding } from '@/core/fixtures/money';
import { decide, type Subject } from '@/core/permissions/policy';
import { sastDate } from '@/core/time/sast';
import { zar } from '@/core/domain/money';
import type { Role } from '@/core/domain/models';

const NOW = sastDate(2026, 10, 5, 9, 40); // a Monday, the demo scenario start

function ctx(
  role: Role = 'student',
  over: Partial<AssistantContext['data']> = {},
  consents: Subject['consents'] = [],
): AssistantContext {
  const subject: Subject = {
    role,
    lifecycle: role === 'parent' ? 'guardian' : role === 'staff' ? 'staff' : role,
    consents,
  };
  return {
    role,
    givenName: 'Thandi',
    now: NOW,
    decide: (c) => decide(subject, c),
    data: {
      map: async () => southCampus,
      account: async () => ({
        accountId: 'a',
        balance: zar(4250),
        dueDate: sastDate(2026, 10, 30, 23, 59).toISOString(),
        status: 'current',
        asAt: sastDate(2026, 10, 5, 8, 42).toISOString(),
      }),
      funding: async () => funding(NOW),
      studySpaces: async (day) => studySpaces(new Date(day), NOW),
      arrivals: async () => [
        {
          routeId: 'route-a',
          stopId: 'stop-si',
          etaMinutes: 5,
          live: true,
          departsAt: sastDate(2026, 10, 5, 9, 45).toISOString(),
        },
      ],
      routes: async () => shuttleRoutes,
      timetable: async (r) => studentTimetable(new Date(r.from), new Date(r.to), NOW),
      exams: async () => exams(NOW),
      knowledge: async () => knowledge(NOW.toISOString()),
      supportRoutes: async () => supportRoutes,
      ...over,
    },
  };
}

describe('intent detection — the brief §6 examples', () => {
  it.each([
    ['Where is EB212?', 'locate'],
    ['How much do I owe?', 'balance'],
    ['Book a study space', 'study-space'],
    ['Find my shuttle', 'shuttle'],
    ['Who handles residence requests?', 'knowledge'],
    ['When is my next class', 'next-class'],
    ['Where is the library?', 'locate'],
    ['Is my NSFAS allowance paid?', 'funding'],
    ['I feel unsafe walking back', 'safety'],
  ])('%s → %s', (q, intent) => {
    expect(detectIntent(q)).toBe(intent);
  });
});

describe('grounded answers', () => {
  it('locates a room from the building register, with a way there', async () => {
    const a = await answerQuestion('Where is EB212?', ctx());
    expect(a.kind).toBe('answer');
    expect(a.text).toContain('level 2 of the Business & Economics Building');
    expect(a.action).toEqual({ label: 'Show me the way', href: '/campus-map?to=EB212' });
  });

  it('states the balance exactly as Student Finance reports it, with its date', async () => {
    const a = await answerQuestion('How much do I owe?', ctx());
    expect(a.text).toContain('R4,250.00');
    expect(a.text).toContain('As at 08:42');
    expect(a.source?.label).toBe('Student Finance');
    expect(a.action?.href).toBe('/money');
  });

  it('never guesses when the finance service is down', async () => {
    const a = await answerQuestion(
      'How much do I owe?',
      ctx('student', {
        account: async () => {
          throw new AdapterError('unavailable', 'finance');
        },
      }),
    );
    expect(a.kind).toBe('unavailable');
    expect(a.text).not.toMatch(/R\d/);
  });

  it('refuses fee questions from roles that cannot see fees', async () => {
    const a = await answerQuestion('How much do I owe?', ctx('staff'));
    expect(a.kind).toBe('denied');
    expect(a.text).not.toMatch(/R\d/);
  });

  it('respects a student’s sharing choices for a parent', async () => {
    const without = await answerQuestion('How much is owed?', ctx('parent'));
    expect(without.kind).toBe('denied');
    const shared = await answerQuestion('How much is owed?', ctx('parent', {}, ['fees']));
    expect(shared.kind).toBe('answer');
    expect(shared.action?.href).toBe('/guardian/fees');
  });

  it('counts real free study rooms this afternoon and offers to book', async () => {
    const a = await answerQuestion('Book a study space', ctx());
    expect(a.text).toMatch(/The Library has \d+ study rooms? available this afternoon/);
    expect(a.action).toEqual({ label: 'Book a study space', href: '/library?tab=spaces' });
  });

  it('gives the live shuttle and mentions disruptions', async () => {
    const a = await answerQuestion('Find my shuttle', ctx());
    expect(a.text).toContain('in 5 min');
    expect(a.text).toContain('Route B');
  });

  it('answers the next class from the timetable', async () => {
    const a = await answerQuestion('When is my next class', ctx());
    expect(a.text).toContain('MKT302 Marketing Management');
    expect(a.text).toContain('EB212');
  });

  it('answers residence questions from an approved article, naming its source', async () => {
    const a = await answerQuestion('Who handles residence requests?', ctx());
    expect(a.kind).toBe('answer');
    expect(a.source?.label).toContain('Residence Life');
    expect(a.action?.href).toBe('/residence/request');
  });

  it('hands off to a person instead of inventing a policy', async () => {
    const a = await answerQuestion('What is the late registration penalty?', ctx());
    expect(a.kind).toBe('handoff');
    expect(a.action?.href).toBeTruthy();
  });

  it('puts a crisis line first, without conditions', async () => {
    const a = await answerQuestion('I want to end my life', ctx('alumni'));
    expect(a.text).toContain('0800 567 567');
    expect(a.action?.href).toBe('tel:0800567567');
  });

  it('only matches articles meant for the asker’s role', () => {
    const articles = knowledge(NOW.toISOString());
    expect(matchArticle('residence request', articles, 'student')?.id).toBe('k-residence');
    expect(matchArticle('residence request', articles, 'parent')).toBeNull();
  });
});
