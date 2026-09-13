import { memo } from 'react';
import { Text } from '@/components/ui';
import { colors } from '@/theme';
import { clockNotice } from '@/utils/storeClock';

export interface StoreTimeNoteProps {
  /** The instant to judge the device's offset at. Defaults to now. */
  at?: Date;
  testID?: string;
}

/**
 * "Times shown are South African time (SAST), not your device's." — or nothing.
 *
 * Every clock time this app draws is a fact about a South African kitchen:
 * when an order was placed, when it is due, which slot was chosen. `storeClock`
 * makes sure of that, and it has been right for several rounds. What nothing
 * had checked was **where the app says so**.
 *
 * `npm run audit:abroad` drives the same journey from three devices and reads
 * every screen that draws an `HH:MM`. From Johannesburg the sentence appears
 * nowhere, correctly. From London and Auckland it appeared on one screen out of
 * three — the scheduler, which had this wording written inline — while the
 * orders list and the notifications drew times with nothing to place them:
 *
 *     Scheduled · Thu, 10 Sep · 18:30
 *
 * A customer in London reads that, looks at their own phone, and has no way to
 * know whether they are two hours early or two hours late for their own dinner.
 *
 * A component rather than a third copy of the JSX. The wording is a promise
 * about how the whole app reports time, and three screens each writing their
 * own version of it is three chances for them to promise different things.
 * `clockNotice` already returns null when the device is on the store's clock,
 * so this renders nothing at all in South Africa and no caller has to ask.
 */
export const StoreTimeNote = memo(function StoreTimeNote({ at, testID }: StoreTimeNoteProps) {
  const notice = at === undefined ? clockNotice() : clockNotice(at);
  if (notice === null) return null;

  return (
    <Text variant="caption" color={colors.textMuted} testID={testID ?? 'store-time-note'}>
      {notice}
    </Text>
  );
});
