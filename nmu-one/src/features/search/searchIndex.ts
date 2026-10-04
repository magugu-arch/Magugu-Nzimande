import type { Href } from 'expo-router';
import type { ServiceEntry } from '@/content/services';
import type {
  Building,
  CampusEvent,
  DirectoryPerson,
  KnowledgeArticle,
  WellbeingService,
} from '@/core/domain/models';
import type { IconName } from '@/design';

/**
 * Global search (brief §6): people, places, services, buildings, events,
 * support resources and answers, in one ranked list grouped by kind. Pure,
 * so the ranking is tested without a screen.
 */
export type ResultKind = 'service' | 'place' | 'person' | 'event' | 'support';

export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: Href;
  icon: IconName;
  score: number;
}

export interface SearchSources {
  services: ServiceEntry[];
  buildings: Building[];
  people: DirectoryPerson[];
  events: CampusEvent[];
  articles: KnowledgeArticle[];
  wellbeing: WellbeingService[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
const words = (s: string) =>
  norm(s)
    .split(/\s+/)
    .filter((w) => w.length > 1);

/** Prefix matches on each query word, weighted towards titles. */
function score(query: string, title: string, extra: string[] = []): number {
  const q = words(query);
  if (!q.length) return 0;
  const t = words(title);
  const e = extra.flatMap(words);
  let total = 0;
  for (const w of q) {
    if (t.some((x) => x === w)) total += 4;
    else if (t.some((x) => x.startsWith(w))) total += 3;
    else if (e.some((x) => x === w || x.startsWith(w))) total += 1;
    else return 0; // every word must match somewhere
  }
  return total;
}

export function search(
  query: string,
  src: SearchSources,
  limitPerKind = 5,
): Record<ResultKind, SearchResult[]> {
  const room = query
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,3})\s?(\d{3})$/);
  const out: SearchResult[] = [];

  for (const s of src.services) {
    const sc = score(query, s.title, [s.summary, ...s.keywords]);
    if (sc)
      out.push({
        kind: 'service',
        id: s.id,
        title: s.title,
        subtitle: s.summary,
        href: s.href,
        icon: s.icon,
        score: sc,
      });
  }
  for (const b of src.buildings) {
    const sc = room && b.code === room[1] ? 10 : score(query, `${b.name} ${b.code}`, b.facilities);
    if (sc) {
      const code = room && b.code === room[1] ? `${room[1]}${room[2]}` : b.code;
      out.push({
        kind: 'place',
        id: b.id,
        title: room && b.code === room[1] ? `${code} · ${b.name}` : b.name,
        subtitle:
          room && b.code === room[1]
            ? `Level ${room[2]![0]} · tap for directions`
            : b.facilities.slice(0, 3).join(' · '),
        href: `/campus-map?to=${code}`,
        icon: 'business-outline',
        score: sc,
      });
    }
  }
  for (const p of src.people) {
    const sc = score(query, p.name, [p.title, p.department]);
    if (sc)
      out.push({
        kind: 'person',
        id: p.id,
        title: p.name,
        subtitle: `${p.title} · ${p.department}`,
        href: '/directory',
        icon: 'person-circle-outline',
        score: sc,
      });
  }
  for (const e of src.events) {
    const sc = score(query, e.title, [e.category, e.venue, e.summary]);
    if (sc)
      out.push({
        kind: 'event',
        id: e.id,
        title: e.title,
        subtitle: e.venue,
        href: `/events/${e.id}`,
        icon: 'sparkles-outline',
        score: sc,
      });
  }
  for (const a of src.articles) {
    const sc = score(query, a.title, a.keywords);
    if (sc && a.action)
      out.push({
        kind: 'support',
        id: a.id,
        title: a.title,
        subtitle: a.source,
        href: a.action.href as Href,
        icon: 'help-buoy-outline',
        score: sc,
      });
  }
  for (const w of src.wellbeing) {
    const sc = score(query, w.name, [w.description, w.kind]);
    if (sc)
      out.push({
        kind: 'support',
        id: w.id,
        title: w.name,
        subtitle: w.description,
        href: '/wellbeing',
        icon: 'heart-outline',
        score: sc,
      });
  }

  const grouped: Record<ResultKind, SearchResult[]> = {
    service: [],
    place: [],
    person: [],
    event: [],
    support: [],
  };
  for (const r of out.sort((a, b) => b.score - a.score)) {
    if (grouped[r.kind].length < limitPerKind) grouped[r.kind].push(r);
  }
  return grouped;
}

export const KIND_TITLES: Record<ResultKind, string> = {
  service: 'Services',
  place: 'Places',
  person: 'People',
  event: 'Events',
  support: 'Help & support',
};
