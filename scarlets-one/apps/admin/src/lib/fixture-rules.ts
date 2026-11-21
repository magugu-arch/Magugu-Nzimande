import { z } from 'zod';
import { optionalText, requiredText } from './validation';
import { fixtureNoticeKinds } from './types';

export const SCORE_REFUSAL =
  'Scores come only from the match-data provider. This console cannot set or change one.';

const SCORE_KEY = /score|result|points|tries/i;

/** Any field that looks like an attempt to send a score. */
export function scoreKeysIn(input: unknown): string[] {
  if (typeof input !== 'object' || input === null) return [];
  return Object.keys(input).filter((key) => SCORE_KEY.test(key));
}

// "24-18", "24 – 18", but not a time range ("14:00-15:30") or a decimal.
const SCORE_PAIR = /(?<![:.\d])\d{1,3}\s*[-–—]\s*\d{1,3}(?![:.\d])/;
const POINTS = /\b\d{1,3}\s*(?:pts|points)\b/i;

/** The score-like fragment in a note, or null. Notices announce changes, never results. */
export function findScoreLike(text: string): string | null {
  return SCORE_PAIR.exec(text)?.[0] ?? POINTS.exec(text)?.[0] ?? null;
}

export const NOTICE_LIMIT = 200;

/**
 * Everything an editorial notice can carry. The object is strict: there is no
 * score field, and an unknown one is an error rather than something ignored.
 */
export const fixtureNoticeFields = z.strictObject({
  kind: z.enum(fixtureNoticeKinds, 'Choose what kind of notice this is.'),
  noteEn: requiredText('the notice in English', NOTICE_LIMIT),
  noteCy: optionalText('the Welsh notice', NOTICE_LIMIT),
});
export type FixtureNoticeFields = z.infer<typeof fixtureNoticeFields>;
