import type { CampusId, NotificationPriority, Role } from '@core/domain/models';
import type { Campaign, CampaignMetrics, Segment } from './types';
import { FACULTIES } from './seed';

/**
 * Audience reach and campaign metrics.
 *
 * SYNTHETIC: NMU ONE has no live population yet, so reach is estimated from
 * an invented population of app users. Live mode replaces this with counts
 * from the BFF's audience endpoint; the console only ever shows totals, never
 * a list of people (brief §24 — minimum necessary personal information).
 */

export const CAMPUSES: { id: CampusId; name: string }[] = [
  { id: 'south', name: 'South Campus' },
  { id: 'north', name: 'North Campus' },
  { id: 'second-avenue', name: 'Second Avenue Campus' },
  { id: 'missionvale', name: 'Missionvale Campus' },
  { id: 'george', name: 'George Campus' },
];

const ROLE_POPULATION: Record<Role, number> = {
  student: 29_400,
  staff: 4_150,
  parent: 7_900,
  alumni: 18_600,
};

const CAMPUS_SHARE: Record<CampusId, number> = {
  south: 0.5,
  north: 0.19,
  'second-avenue': 0.12,
  missionvale: 0.11,
  george: 0.08,
};

const FACULTY_SHARE: Record<string, number> = {
  'Business & Economic Sciences': 0.24,
  Education: 0.13,
  'Engineering, Built Environment & Technology': 0.16,
  'Health Sciences': 0.13,
  Humanities: 0.14,
  Law: 0.07,
  Science: 0.13,
};

/** Students in residence, as a share of students. */
const RESIDENCE_SHARE = 0.21;

/** Faculty and residence only describe students (and, for faculty, staff). */
export function estimateReach(
  segment: Pick<Segment, 'roles' | 'campuses' | 'faculties' | 'residenceOnly'>,
): number {
  const campusShare =
    segment.campuses === 'all' ? 1 : segment.campuses.reduce((s, c) => s + CAMPUS_SHARE[c], 0);
  const facultyShare =
    segment.faculties === 'all'
      ? 1
      : segment.faculties.reduce((s, f) => s + (FACULTY_SHARE[f] ?? 0), 0);
  let total = 0;
  for (const role of segment.roles) {
    let n = ROLE_POPULATION[role] * campusShare;
    if (role === 'student' || role === 'staff') n *= facultyShare;
    if (segment.residenceOnly) n = role === 'student' ? n * RESIDENCE_SHARE : 0;
    total += n;
  }
  return Math.round(total);
}

export function describeSegment(segment: Segment): string {
  const roles = segment.roles.map((r) => ROLE_LABELS[r].toLowerCase()).join(', ');
  const campuses =
    segment.campuses === 'all'
      ? 'all campuses'
      : segment.campuses.map((c) => CAMPUSES.find((x) => x.id === c)?.name ?? c).join(', ');
  const faculties = segment.faculties === 'all' ? null : segment.faculties.join(', ');
  return [roles, campuses, faculties, segment.residenceOnly ? 'in residence' : null]
    .filter(Boolean)
    .join(' · ');
}

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Students',
  staff: 'Staff',
  parent: 'Parents',
  alumni: 'Alumni',
};

export const ALL_FACULTIES: readonly string[] = FACULTIES;

const OPEN_RATE: Record<NotificationPriority, number> = {
  emergency: 0.86,
  high: 0.64,
  normal: 0.41,
  low: 0.24,
};

/** A stable 0–1 number from a string, so demo metrics don't jump around. */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Funnel for a sent campaign. Opens climb over the first hours after sending,
 * so a just-sent notice shows a believable, still-growing count.
 */
export function metricsFor(
  campaign: Campaign,
  segment: Segment | undefined,
  now: Date,
): CampaignMetrics | null {
  if (campaign.status !== 'sent' || !campaign.sentAt || !segment) return null;
  const targeted = estimateReach(segment);
  const j = jitter(campaign.id);
  const delivered = Math.round(targeted * (0.955 + j * 0.03));
  const minutes = Math.max(0, (now.getTime() - new Date(campaign.sentAt).getTime()) / 60_000);
  // ~2% open in the first moments, about half by the first hour, most by three.
  const settle = 1 - Math.exp(-(minutes + 2) / 90);
  const opened = Math.round(delivered * OPEN_RATE[campaign.priority] * (0.9 + j * 0.2) * settle);
  const actioned = campaign.deepLink ? Math.round(opened * (0.38 + j * 0.2)) : 0;
  return { targeted, delivered, opened, actioned };
}

export const pct = (part: number, whole: number) =>
  whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;

/** "29,400" — grouped like the app's money amounts. */
export const fmt = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
