import { z } from 'zod';
import { isoInstant, optionalText, requiredText } from './validation';
import { DAY } from './time';
import { pushCategories, segmentIds, type PushCategory, type Segment } from './types';

export const PUSH_LIMITS = { title: 60, body: 170 } as const;

export interface FrequencyCap {
  max: number;
  windowMs: number;
  /** The window in words, for messages. */
  window: string;
}

/**
 * Frequency caps, per segment. Marketing is held tightly; service messages
 * get more room because a matchday can need several, but they are capped too.
 * PLACEHOLDER VALUES: the club's digital lead and data protection officer set
 * the real ones (see the notifications integration gate).
 */
export const FREQUENCY_CAPS: Record<PushCategory, FrequencyCap> = {
  marketing: { max: 2, windowMs: 7 * DAY, window: '7 days' },
  service: { max: 4, windowMs: DAY, window: '24 hours' },
};

export const notificationFields = z.object({
  titleEn: requiredText('an English title', PUSH_LIMITS.title),
  titleCy: optionalText('the Welsh title', PUSH_LIMITS.title),
  bodyEn: requiredText('an English message', PUSH_LIMITS.body),
  bodyCy: optionalText('the Welsh message', PUSH_LIMITS.body),
  segment: z.enum(segmentIds, 'Choose who receives it.'),
  category: z.enum(pushCategories, 'Choose service message or marketing.'),
  sendAt: isoInstant('Choose a send time.'),
});
export type NotificationFields = z.infer<typeof notificationFields>;

/** A test needs the words and the category, not an audience or a time. */
export const testNotificationFields = notificationFields.pick({
  titleEn: true,
  titleCy: true,
  bodyEn: true,
  bodyCy: true,
  category: true,
});
export type TestNotificationFields = z.infer<typeof testNotificationFields>;

/**
 * Marketing reaches only people who gave marketing consent. A service
 * message reaches everyone in the segment with push switched on, because it
 * is about something they already hold or follow.
 */
export function recipientsFor(segment: Segment, category: PushCategory): number {
  return category === 'marketing' ? segment.marketingConsent : segment.pushEnabled;
}

export type CapCheck = { breached: false } | { breached: true; clashing: number[] };

/**
 * Would sending at `candidate` put more than `cap.max` pushes inside any
 * rolling window? `existing` holds the send times already counted for the
 * same segment and category. Returns the pushes it would crowd.
 */
export function checkFrequencyCap(
  candidate: number,
  existing: readonly number[],
  cap: FrequencyCap,
): CapCheck {
  const times = [...existing, candidate].sort((a, b) => a - b);
  for (let i = 0; i + cap.max < times.length; i += 1) {
    const first = times[i] as number;
    const last = times[i + cap.max] as number;
    const includesCandidate = first <= candidate && candidate <= last;
    if (includesCandidate && last - first < cap.windowMs) {
      const clashing = times.slice(i, i + cap.max + 1);
      clashing.splice(clashing.indexOf(candidate), 1);
      return { breached: true, clashing };
    }
  }
  return { breached: false };
}
