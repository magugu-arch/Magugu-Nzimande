import { findBuilding, parseRoomCode, routeTo } from '../campus/routing';
import type {
  CampusMap,
  Exam,
  FeeAccount,
  FundingStatus,
  KnowledgeArticle,
  Role,
  ShuttleArrival,
  ShuttleRoute,
  StudySpace,
  SupportRoute,
  TimetableEntry,
} from '../domain/models';
import { formatMoney } from '../domain/money';
import type { Capability, Decision } from '../permissions/policy';
import {
  addDays,
  formatCountdown,
  formatDayShort,
  formatRelativeDay,
  formatTime,
  sastParts,
  startOfSastDay,
} from '../time/sast';

/**
 * The NMU ONE assistant — brief §6.
 *
 * Deliberately not generative. Each question is routed to an intent, and the
 * answer is assembled *only* from connected-service data or an approved help
 * article, so it cannot invent a fee, a deadline, a policy or a safety
 * procedure. Every answer:
 *   - respects role permissions (the same `decide()` the screens use),
 *   - names its source and, where known, when it was last updated,
 *   - offers a next action,
 *   - and hands off to a person when it is not sure.
 *
 * A live, model-backed assistant can replace `answer()` behind the same
 * `AssistantAnswer` contract, provided it keeps those four rules.
 */

export type IntentId =
  | 'safety'
  | 'crisis'
  | 'locate'
  | 'next-class'
  | 'balance'
  | 'funding'
  | 'study-space'
  | 'shuttle'
  | 'exams'
  | 'knowledge'
  | 'handoff';

export interface AssistantLink {
  label: string;
  href: string;
}

export interface AssistantAnswer {
  intent: IntentId;
  kind: 'answer' | 'denied' | 'unavailable' | 'handoff';
  text: string;
  source: { label: string; updatedAt: string | null } | null;
  action: AssistantLink | null;
  secondary: AssistantLink | null;
}

export interface AssistantContext {
  role: Role;
  givenName: string;
  now: Date;
  decide(capability: Capability): Decision;
  data: {
    map(): Promise<CampusMap>;
    account(): Promise<FeeAccount>;
    funding(): Promise<FundingStatus>;
    studySpaces(day: string): Promise<StudySpace[]>;
    arrivals(): Promise<ShuttleArrival[]>;
    routes(): Promise<ShuttleRoute[]>;
    timetable(range: { from: string; to: string }): Promise<TimetableEntry[]>;
    exams(): Promise<Exam[]>;
    knowledge(): Promise<KnowledgeArticle[]>;
    supportRoutes(): Promise<SupportRoute[]>;
  };
}

const INTENT_PATTERNS: [IntentId, RegExp][] = [
  ['crisis', /\b(suicid\w*|kill myself|end my life|self[- ]harm|want to die)\b/i],
  ['safety', /\b(emergency|unsafe|danger|attack\w*|followed|threat\w*|robbed|assault\w*|security)\b/i],
  ['funding', /\b(nsfas|funding|allowance|bursary)\b/i],
  ['balance', /\b(owe|balance|outstanding|fees?|how much|statement)\b/i],
  ['study-space', /\b(study (space|room)s?|group room|silent pod|quiet (place|space)|book (a )?(room|space))\b/i],
  ['shuttle', /\b(shuttle|bus|route [abn]\b|transport|lift to)\b/i],
  ['next-class', /\b(next (class|lecture)|my (class|lecture)|timetable|class today|lectures? today)\b/i],
  ['exams', /\b(exams?|tests?|assessments?|deadlines?|due)\b/i],
  ['locate', /\b(where is|where's|find|directions to|how do i get to|take me to)\b/i],
];

const ROOM_PATTERN = /\b([A-Za-z]{1,3})\s?(\d{3})\b/;

export function detectIntent(query: string): IntentId {
  if (ROOM_PATTERN.test(query) && parseRoomCode(query.match(ROOM_PATTERN)![0])) {
    // "Where is EB212?" — a room code outranks generic words like "find".
    const generic = INTENT_PATTERNS.find(([id, re]) => (id === 'crisis' || id === 'safety') && re.test(query));
    return generic ? generic[0] : 'locate';
  }
  for (const [id, re] of INTENT_PATTERNS) if (re.test(query)) return id;
  return 'knowledge';
}

const answer = (
  intent: IntentId,
  text: string,
  extra: Partial<Omit<AssistantAnswer, 'intent' | 'text' | 'kind'>> & { kind?: AssistantAnswer['kind'] } = {},
): AssistantAnswer => ({
  intent,
  kind: extra.kind ?? 'answer',
  text,
  source: extra.source ?? null,
  action: extra.action ?? null,
  secondary: extra.secondary ?? null,
});

function denied(intent: IntentId, decision: Decision, what: string, ctx: AssistantContext): AssistantAnswer {
  if (!decision.allowed && decision.reason === 'consent') {
    return answer(intent, `This hasn't been shared with you. Only the student can share ${what} with you, from their own privacy settings.`, {
      kind: 'denied',
      action: { label: 'See what is shared', href: '/guardian' },
    });
  }
  const roleName = { student: 'students', staff: 'staff', parent: 'parents and guardians', alumni: 'alumni' }[ctx.role];
  return answer(intent, `${what[0]!.toUpperCase()}${what.slice(1)} isn't part of NMU ONE for ${roleName}.`, {
    kind: 'denied',
  });
}

const unavailable = (intent: IntentId, service: string, href: string): AssistantAnswer =>
  answer(
    intent,
    `I can't reach ${service} right now, so I won't guess. Try again in a moment, or open it directly.`,
    { kind: 'unavailable', action: { label: `Open ${service}`, href } },
  );

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

/** Best approved article for a question, or null below the confidence bar. */
export function matchArticle(query: string, articles: KnowledgeArticle[], role: Role): KnowledgeArticle | null {
  const q = tokens(query);
  let best: { a: KnowledgeArticle; score: number } | null = null;
  for (const a of articles) {
    if (!a.roles.includes(role)) continue;
    const keywords = new Set(a.keywords);
    const score =
      q.filter((t) => keywords.has(t)).length * 2 +
      q.filter((t) => tokens(a.title).includes(t)).length;
    if (score > (best?.score ?? 0)) best = { a, score };
  }
  return best && best.score >= 2 ? best.a : null;
}

async function handoff(ctx: AssistantContext): Promise<AssistantAnswer> {
  let desk: SupportRoute | undefined;
  try {
    desk = (await ctx.data.supportRoutes()).find((r) => r.id === 'route-helpdesk');
  } catch {
    desk = undefined;
  }
  return answer(
    'handoff',
    "I don't have an approved answer for that, and I won't guess. The Student Help Desk can find the right person — or ask me about classes, fees, study spaces, shuttles or places on campus.",
    {
      kind: 'handoff',
      source: desk ? { label: desk.name, updatedAt: null } : null,
      action: desk?.href ? { label: `Find the ${desk.name}`, href: desk.href } : null,
    },
  );
}

export async function answerQuestion(query: string, ctx: AssistantContext): Promise<AssistantAnswer> {
  const intent = detectIntent(query);
  const trimmed = query.trim();
  if (!trimmed) return handoff(ctx);

  switch (intent) {
    case 'crisis':
      return answer(
        'crisis',
        "You don't have to deal with this alone. Call the SADAG Suicide Crisis Helpline on 0800 567 567 — free, 24 hours. If you are in immediate danger, call 112.",
        {
          source: { label: 'Student Wellness', updatedAt: null },
          action: { label: 'Call 0800 567 567', href: 'tel:0800567567' },
          secondary: { label: 'Open Wellbeing', href: '/wellbeing' },
        },
      );

    case 'safety':
      return answer(
        'safety',
        'If you are in danger, call 10111 now, or 112 from any mobile. Safety in NMU ONE lets you share your location with Campus Protection and see every emergency number.',
        {
          source: { label: 'Protection Services', updatedAt: null },
          action: { label: 'Open Safety', href: '/safety' },
          secondary: { label: 'Call 10111', href: 'tel:10111' },
        },
      );

    case 'locate': {
      let map: CampusMap;
      try {
        map = await ctx.data.map();
      } catch {
        return unavailable('locate', 'the campus map', '/campus-map');
      }
      const room = trimmed.match(ROOM_PATTERN)?.[0];
      const parsed = room ? parseRoomCode(room) : null;
      const subject = (parsed?.code ?? trimmed.replace(/^(where is|where's|find|directions to|how do i get to|take me to)\s+(the\s+)?/i, '').replace(/[?.!]+$/, '')).trim();
      const building = findBuilding(map, subject);
      if (!building) return handoff(ctx);
      const route = routeTo(map, map.defaultOrigin, building, parsed?.floor);
      const where = parsed
        ? `${parsed.code} is on ${parsed.floor === 0 ? 'the ground floor' : `level ${parsed.floor}`} of the ${building.name} (${building.code}), ${map.name}.`
        : `The ${building.name} (${building.code}) is on ${map.name}.`;
      const walk = route ? ` About ${route.walkingMinutes} min on foot from the Main Gate.` : '';
      return answer('locate', `${where}${walk}`, {
        source: { label: 'Campus buildings register', updatedAt: null },
        action: { label: 'Show me the way', href: `/campus-map?to=${parsed?.code ?? building.code}` },
      });
    }

    case 'next-class': {
      const d = ctx.decide('academics.timetable');
      if (!d.allowed) return denied('next-class', d, 'the timetable', ctx);
      let entries: TimetableEntry[];
      try {
        entries = await ctx.data.timetable({
          from: startOfSastDay(ctx.now).toISOString(),
          to: addDays(startOfSastDay(ctx.now), 7).toISOString(),
        });
      } catch {
        return unavailable('next-class', 'your timetable', '/academics/timetable');
      }
      const next = entries.find((e) => new Date(e.end) > ctx.now && e.status !== 'cancelled');
      if (!next) {
        return answer('next-class', 'You have no more classes scheduled this week.', {
          source: { label: 'Timetabling', updatedAt: null },
          action: { label: 'Open timetable', href: '/academics/timetable' },
        });
      }
      const when = new Date(next.start) <= ctx.now ? 'is on now' : formatCountdown(next.start, ctx.now);
      return answer(
        'next-class',
        `${next.moduleCode} ${next.moduleTitle} — ${formatRelativeDay(next.start, ctx.now).toLowerCase()} at ${formatTime(next.start)} in ${next.room.code} (${when}).${next.note ? ` ${next.note}.` : ''}`,
        {
          source: { label: 'Timetabling', updatedAt: null },
          action: { label: 'Show me the way', href: `/campus-map?to=${next.room.code}` },
          secondary: { label: 'Class details', href: `/academics/class/${next.id}` },
        },
      );
    }

    case 'balance': {
      const d = ctx.decide('finance.view');
      if (!d.allowed) return denied('balance', d, 'fee information', ctx);
      if (ctx.role === 'parent') {
        return answer('balance', 'You can see the fee position that has been shared with you under Family.', {
          action: { label: 'View shared fees', href: '/guardian/fees' },
        });
      }
      let account: FeeAccount;
      try {
        account = await ctx.data.account();
      } catch {
        return unavailable('balance', 'Student Finance', '/money');
      }
      const asAt = `As at ${formatTime(account.asAt)} ${formatRelativeDay(account.asAt, ctx.now).toLowerCase()}.`;
      const text =
        account.balance.cents > 0
          ? `You owe ${formatMoney(account.balance)}${account.dueDate ? `, due ${formatDayShort(account.dueDate)}` : ''}. ${asAt}`
          : account.balance.cents < 0
            ? `Your account is ${formatMoney({ ...account.balance, cents: -account.balance.cents })} in credit. ${asAt}`
            : `Your fee account is fully paid. ${asAt}`;
      return answer('balance', text, {
        source: { label: 'Student Finance', updatedAt: account.asAt },
        action: { label: 'View fees', href: '/money' },
        secondary: account.balance.cents > 0 ? { label: 'Make a payment', href: '/money/pay' } : null,
      });
    }

    case 'funding': {
      const d = ctx.decide('funding.view');
      if (!d.allowed) return denied('funding', d, 'funding information', ctx);
      let f: FundingStatus;
      try {
        f = await ctx.data.funding();
      } catch {
        return unavailable('funding', 'Student Funding', '/money/funding');
      }
      return answer('funding', `${f.providerName}: ${f.headline}. ${f.detail}`, {
        source: { label: 'Student Funding', updatedAt: f.updatedAt },
        action: { label: 'View funding status', href: '/money/funding' },
      });
    }

    case 'study-space': {
      const d = ctx.decide('library.book');
      if (!d.allowed) return denied('study-space', d, 'study-space booking', ctx);
      let spaces: StudySpace[];
      try {
        spaces = await ctx.data.studySpaces(startOfSastDay(ctx.now).toISOString());
      } catch {
        return unavailable('study-space', 'the Library', '/library?tab=spaces');
      }
      const afternoon = spaces
        .map((s) => ({
          s,
          slot: s.slots.find((sl) => sl.available && sastParts(sl.start).hours >= 12),
        }))
        .filter((x) => x.slot);
      if (afternoon.length === 0) {
        return answer('study-space', 'Every study room is booked for the rest of today. Tomorrow’s slots open in the Library.', {
          source: { label: 'Library bookings', updatedAt: ctx.now.toISOString() },
          action: { label: 'See study spaces', href: '/library?tab=spaces' },
        });
      }
      const earliest = afternoon.sort((a, b) => a.slot!.start.localeCompare(b.slot!.start))[0]!;
      return answer(
        'study-space',
        `The Library has ${afternoon.length} study ${afternoon.length === 1 ? 'room' : 'rooms'} available this afternoon — the earliest is ${earliest.s.name} at ${formatTime(earliest.slot!.start)}.`,
        {
          source: { label: 'Library bookings', updatedAt: ctx.now.toISOString() },
          action: { label: 'Book a study space', href: '/library?tab=spaces' },
        },
      );
    }

    case 'shuttle': {
      const d = ctx.decide('transport.view');
      if (!d.allowed) return denied('shuttle', d, 'shuttle information', ctx);
      let arrivals: ShuttleArrival[];
      let routes: ShuttleRoute[];
      try {
        [arrivals, routes] = await Promise.all([ctx.data.arrivals(), ctx.data.routes()]);
      } catch {
        return unavailable('shuttle', 'shuttle tracking', '/transport');
      }
      const running = arrivals.filter((a) => a.live && a.stopId === 'stop-si');
      const next = running[0];
      const delayed = routes.filter((r) => r.status === 'delayed' || r.status === 'disrupted');
      if (!next) {
        return answer('shuttle', 'No shuttles are running from the Shuttle Interchange right now.', {
          source: { label: 'Campus Transport', updatedAt: ctx.now.toISOString() },
          action: { label: 'See shuttle times', href: '/transport' },
        });
      }
      const route = routes.find((r) => r.id === next.routeId);
      const note = delayed.length ? ` ${delayed.map((r) => `Route ${r.code}: ${r.statusNote ?? 'delayed'}`).join(' ')}` : '';
      return answer(
        'shuttle',
        `Route ${route?.code} (${route?.name}) leaves the Shuttle Interchange in ${next.etaMinutes} min, at ${formatTime(next.departsAt)}.${note}`,
        {
          source: { label: 'Campus Transport — live tracking', updatedAt: ctx.now.toISOString() },
          action: { label: 'See shuttle times', href: `/transport/${next.routeId}` },
        },
      );
    }

    case 'exams': {
      const d = ctx.decide('academics.exams');
      if (!d.allowed) return denied('exams', d, 'assessment information', ctx);
      let list: Exam[];
      try {
        list = await ctx.data.exams();
      } catch {
        return unavailable('exams', 'Examinations', '/academics/exams');
      }
      const next = list.filter((e) => new Date(e.start) > ctx.now).sort((a, b) => a.start.localeCompare(b.start))[0];
      if (!next) return answer('exams', 'You have no upcoming assessments published.', { action: { label: 'View assessments', href: '/academics/exams' } });
      return answer(
        'exams',
        `Next up: ${next.moduleCode} ${next.kind === 'assignment' ? 'submission' : next.kind} — ${formatDayShort(next.start)} at ${formatTime(next.start)}${next.venue ? ` in ${next.venue.code}` : ''} (${next.weightPercent}% of the module).`,
        {
          source: { label: 'Examinations', updatedAt: null },
          action: { label: 'View assessments', href: '/academics/exams' },
        },
      );
    }

    case 'knowledge':
    case 'handoff': {
      let articles: KnowledgeArticle[] = [];
      try {
        articles = await ctx.data.knowledge();
      } catch {
        articles = [];
      }
      const article = matchArticle(trimmed, articles, ctx.role);
      if (!article) return handoff(ctx);
      return answer('knowledge', article.body, {
        source: { label: article.source, updatedAt: article.updatedAt },
        action: article.action,
      });
    }
  }
}

export const SUGGESTED_QUESTIONS: Record<Role, string[]> = {
  student: ['Where is EB212?', 'How much do I owe?', 'Book a study space', 'Find my shuttle', 'Who handles residence requests?'],
  staff: ['Where is EB212?', 'Find my shuttle', 'Book a study space', 'Where is the Student Centre?'],
  parent: ['How much is owed?', 'Where is the Main Hall?', 'I feel unsafe on campus'],
  alumni: ['Where is the Main Hall?', 'Who handles residence requests?', 'I need to talk to someone'],
};
