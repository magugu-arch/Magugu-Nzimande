/**
 * The studio's own content, as answered in the launch checklist (the
 * "Grateful Launch Checklist" page), turned into src/data/studio-content.json
 * by `npm run apply:intake`. The site reads that file; an empty value means
 * "not supplied yet", and the site keeps its neutral default.
 *
 * No imports and only erasable TypeScript, so node runs this file directly.
 */

export type StudioContent = {
  work: Record<string, { title: string | null; year: number | null }>;
  credits: Record<string, string | null>;
  social: { instagram: string | null; facebook: string | null; tiktok: string | null; other: string | null };
  privacy: { officer: string | null; email: string | null; retention: string | null };
};

export const WORK_SLUGS = ['garment-study-01', 'garment-study-02', 'garment-study-03'] as const;
export const PHOTO_KEYS = ['burgundyGown', 'whiteShirtLook', 'greenGown', 'navyDress', 'burgundyDetail'] as const;

export function emptyContent(): StudioContent {
  return {
    work: Object.fromEntries(WORK_SLUGS.map((s) => [s, { title: null, year: null }])),
    credits: Object.fromEntries(PHOTO_KEYS.map((k) => [k, null])),
    social: { instagram: null, facebook: null, tiktok: null, other: null },
    privacy: { officer: null, email: null, retention: null },
  };
}

/** Collapse whitespace, strip control characters and cap the length; empty → null. */
function text(v: unknown, max = 160): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return t || null;
}

export type IntakeResult = {
  content: StudioContent;
  /** Answers that were given but could not be used, and why. */
  problems: string[];
  /** Answers that go somewhere other than this file (the dashboard, a person). */
  followUp: string[];
};

/** Turn the checklist's saved answers into site content. Never throws on bad input: it reports it. */
export function contentFromIntake(raw: Record<string, unknown>): IntakeResult {
  const content = emptyContent();
  const problems: string[] = [];
  const followUp: string[] = [];
  const thisYear = new Date().getFullYear();

  WORK_SLUGS.forEach((slug, i) => {
    const n = String(i + 1).padStart(2, '0');
    content.work[slug]!.title = text(raw[`work${n}_name`], 60);
    const y = text(raw[`work${n}_year`], 10);
    if (y) {
      const year = Number(y);
      if (/^\d{4}$/.test(y) && year >= 1990 && year <= thisYear + 1) content.work[slug]!.year = year;
      else problems.push(`Garment Study ${n}: "${y}" is not a year, so no year is shown.`);
    }
  });

  for (const k of PHOTO_KEYS) {
    content.credits[k] = text(raw[`credit_${k}`], 80);
    if (raw[`rights_${k}`] !== true) followUp.push(`Photo permission not yet confirmed: ${k}.`);
  }

  for (const k of ['instagram', 'facebook', 'tiktok', 'other'] as const) {
    const v = text(raw[`social_${k}`], 300);
    if (!v) continue;
    let url: URL | null;
    try {
      url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    } catch {
      url = null;
    }
    if (url && url.protocol === 'https:' && url.hostname.includes('.')) content.social[k] = url.toString();
    else problems.push(`Social link for ${k} is not a web address ("${v}"), so it is left off.`);
  }

  content.privacy.officer = text(raw.privacy_officer, 120);
  content.privacy.retention = text(raw.privacy_retention, 300);
  const email = text(raw.privacy_email, 120);
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) content.privacy.email = email;
  else if (email) problems.push(`Privacy email "${email}" is not an email address, so the studio email is used.`);

  for (const [key, label] of [
    ['hours_text', 'Opening hours (enter in the dashboard: Opening hours)'],
    ['prices_text', 'Prices and deposits (enter in the dashboard: Services & prices)'],
    ['durations_text', 'Appointment lengths (enter in the dashboard: Services & prices)'],
    ['wording_notes', 'Wording changes (edit the copy)'],
    ['domain', 'Web address (set SITE_URL and connect the domain)'],
  ] as const) {
    const v = text(raw[key], 2000);
    if (v) followUp.push(`${label}: ${v}`);
  }
  return { content, problems, followUp };
}
