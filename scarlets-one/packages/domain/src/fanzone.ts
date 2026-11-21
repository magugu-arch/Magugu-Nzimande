import { z } from 'zod';
import { localizedText } from './i18n';

const sponsorship = z.object({ label: localizedText, partnerName: z.string() });

const base = {
  id: z.string(),
  title: localizedText,
  prompt: localizedText,
  /** ISO UTC. An activity accepts entries only inside this window. */
  opensAt: z.string(),
  closesAt: z.string(),
  fixtureId: z.string().optional(),
  /** Paid placements carry a visible label; null means editorial. */
  sponsorship: sponsorship.nullable(),
  requiresSignIn: z.boolean(),
  demo: z.boolean(),
};

export const pollOption = z.object({ id: z.string(), label: localizedText });

export const pollActivity = z.object({
  ...base,
  kind: z.literal('poll'),
  options: z.array(pollOption).min(2),
});

/** Score prediction. Closes at kick-off. No stakes, odds or prizes of chance. */
export const predictionActivity = z.object({
  ...base,
  kind: z.literal('prediction'),
  homeName: z.string(),
  awayName: z.string(),
});

export const quizQuestion = z.object({
  id: z.string(),
  prompt: localizedText,
  options: z.array(pollOption).min(2),
  answerId: z.string(),
  explanation: localizedText,
});

export const quizActivity = z.object({
  ...base,
  kind: z.literal('quiz'),
  questions: z.array(quizQuestion).min(1),
  editorialStatus: z.enum(['approved', 'awaiting_approval']),
});

export const fanCamActivity = z.object({
  ...base,
  kind: z.literal('fan_cam'),
  minimumAge: z.number().int(),
});

export const challengeActivity = z.object({
  ...base,
  kind: z.literal('challenge'),
  steps: z.array(z.object({ id: z.string(), label: localizedText })),
  /** A way to take part that does not need moving around the venue. */
  accessibleAlternative: localizedText,
});

export const fanActivity = z.discriminatedUnion('kind', [
  pollActivity,
  predictionActivity,
  quizActivity,
  fanCamActivity,
  challengeActivity,
]);
export type FanActivity = z.infer<typeof fanActivity>;
export type PollActivity = z.infer<typeof pollActivity>;
export type PredictionActivity = z.infer<typeof predictionActivity>;
export type QuizActivity = z.infer<typeof quizActivity>;
export type FanCamActivity = z.infer<typeof fanCamActivity>;
export type ChallengeActivity = z.infer<typeof challengeActivity>;
export type ActivityKind = FanActivity['kind'];

/** Explicit, separate permissions. A photo is not accepted without all three. */
export const fanCamConsent = z.object({
  ageOrGuardian: z.literal(true),
  peopleInPhoto: z.literal(true),
  displayAndModeration: z.literal(true),
});

export const submission = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('poll'), activityId: z.string(), optionId: z.string() }),
  z.object({
    kind: z.literal('prediction'),
    activityId: z.string(),
    home: z.number().int().min(0).max(150),
    away: z.number().int().min(0).max(150),
  }),
  z.object({
    kind: z.literal('quiz'),
    activityId: z.string(),
    answers: z.record(z.string(), z.string()),
  }),
  z.object({
    kind: z.literal('fan_cam'),
    activityId: z.string(),
    /** Opaque reference to the uploaded file. Never a public URL. */
    mediaRef: z.string().min(1),
    caption: z.string().max(140).optional(),
    consent: fanCamConsent,
  }),
  z.object({ kind: z.literal('challenge'), activityId: z.string(), stepId: z.string() }),
]);
export type Submission = z.infer<typeof submission>;

export const moderationStatus = z.enum([
  'not_required',
  'pending',
  'approved',
  'rejected',
  'withdrawn',
]);
export type ModerationStatus = z.infer<typeof moderationStatus>;

export const receipt = z.object({
  id: z.string(),
  activityId: z.string(),
  kind: z.enum(['poll', 'prediction', 'quiz', 'fan_cam', 'challenge']),
  submittedAt: z.string(),
  moderation: moderationStatus,
  /** What was entered, kept so the supporter can see their own answer. */
  summary: z.string(),
  submission,
});
export type Receipt = z.infer<typeof receipt>;

export type SubmitError =
  | 'not_open'
  | 'closed'
  | 'duplicate'
  | 'rate_limited'
  | 'sign_in_required'
  | 'consent_required'
  | 'offline'
  | 'invalid';

export type ActivityWindow = 'upcoming' | 'open' | 'closed';

export function activityWindow(activity: FanActivity, now: Date): ActivityWindow {
  const t = now.getTime();
  if (t < new Date(activity.opensAt).getTime()) return 'upcoming';
  if (t >= new Date(activity.closesAt).getTime()) return 'closed';
  return 'open';
}

/** Submissions allowed per account per minute across the whole Fan Zone. */
export const RATE_LIMIT_PER_MINUTE = 6;

export interface SubmitContext {
  now: Date;
  signedIn: boolean;
  /** Everything this account or device has already submitted. */
  previous: readonly Receipt[];
}

/**
 * The single gate every Fan Zone entry passes, on the server and in the demo
 * adapter alike. Order matters: a closed poll says "closed", not "duplicate".
 */
export function validateSubmission(
  activity: FanActivity,
  input: unknown,
  ctx: SubmitContext,
): { ok: true; value: Submission } | { ok: false; error: SubmitError } {
  const window = activityWindow(activity, ctx.now);
  if (window === 'upcoming') return { ok: false, error: 'not_open' };
  if (window === 'closed') return { ok: false, error: 'closed' };
  if (activity.requiresSignIn && !ctx.signedIn) return { ok: false, error: 'sign_in_required' };

  const raw = input as { kind?: unknown; consent?: Record<string, unknown> } | null;
  if (raw && raw.kind === 'fan_cam') {
    const consent = raw.consent ?? {};
    if (!(consent.ageOrGuardian && consent.peopleInPhoto && consent.displayAndModeration)) {
      return { ok: false, error: 'consent_required' };
    }
  }

  const parsed = submission.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const value = parsed.data;
  if (value.kind !== activity.kind || value.activityId !== activity.id) {
    return { ok: false, error: 'invalid' };
  }

  if (activity.kind === 'poll' && value.kind === 'poll') {
    if (!activity.options.some((o) => o.id === value.optionId))
      return { ok: false, error: 'invalid' };
  }
  if (activity.kind === 'challenge' && value.kind === 'challenge') {
    if (!activity.steps.some((s) => s.id === value.stepId)) return { ok: false, error: 'invalid' };
  }

  const mine = ctx.previous.filter(
    (r) => r.activityId === activity.id && r.moderation !== 'withdrawn',
  );
  const repeatable = activity.kind === 'fan_cam' || activity.kind === 'challenge';
  if (!repeatable && mine.length > 0) return { ok: false, error: 'duplicate' };
  if (activity.kind === 'challenge' && value.kind === 'challenge') {
    const done = mine.some(
      (r) => r.submission.kind === 'challenge' && r.submission.stepId === value.stepId,
    );
    if (done) return { ok: false, error: 'duplicate' };
  }

  const minuteAgo = ctx.now.getTime() - 60_000;
  const recent = ctx.previous.filter((r) => new Date(r.submittedAt).getTime() > minuteAgo).length;
  if (recent >= RATE_LIMIT_PER_MINUTE) return { ok: false, error: 'rate_limited' };

  return { ok: true, value };
}

/** Anything a supporter uploads is held for a moderator before anyone else sees it. */
export function initialModeration(kind: ActivityKind): ModerationStatus {
  return kind === 'fan_cam' ? 'pending' : 'not_required';
}

export interface Tally {
  optionId: string;
  votes: number;
  percent: number;
}

/** Whole-number percentages that always add up to 100 (largest remainder). */
export function tally(
  optionIds: readonly string[],
  votes: Readonly<Record<string, number>>,
): Tally[] {
  const counts = optionIds.map((id) => Math.max(0, votes[id] ?? 0));
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return optionIds.map((optionId) => ({ optionId, votes: 0, percent: 0 }));
  const exact = counts.map((n) => (n / total) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((sum, n) => sum + n, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floors[index] = (floors[index] as number) + 1;
    remainder -= 1;
  }
  return optionIds.map((optionId, index) => ({
    optionId,
    votes: counts[index] as number,
    percent: floors[index] as number,
  }));
}

export function quizScore(
  activity: QuizActivity,
  answers: Readonly<Record<string, string>>,
): { correct: number; total: number } {
  const correct = activity.questions.filter((q) => answers[q.id] === q.answerId).length;
  return { correct, total: activity.questions.length };
}

export const supporterStory = z.object({
  id: z.string(),
  title: localizedText,
  body: localizedText,
  mediaId: z.string(),
  attribution: localizedText,
  moderation: moderationStatus,
  demo: z.boolean(),
});
export type SupporterStory = z.infer<typeof supporterStory>;

export const reportReason = z.enum(['inappropriate', 'safety', 'privacy', 'spam', 'other']);
export type ReportReason = z.infer<typeof reportReason>;
