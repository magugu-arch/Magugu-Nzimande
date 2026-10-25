/**
 * Branch policy, evaluated on the server. Deposits and refunds are computed
 * here from the branch's current policy and never taken from the client.
 */

import type { BookingPolicy, DepositRule, ServicePeriodId } from '../types.ts';
import { HOUR, formatZar } from '../util/core.ts';
import type { Minor } from '../util/core.ts';
import { weekday } from '../util/time.ts';
import type { DateKey } from '../util/time.ts';

export interface DepositQuote {
  amountMinor: Minor;
  perGuestMinor: Minor;
  rule: DepositRule | null;
}

export function depositFor(
  policy: BookingPolicy,
  slot: { date: DateKey; period: ServicePeriodId; partySize: number },
): DepositQuote {
  const day = weekday(slot.date);
  const applicable = policy.deposits.filter(
    (r) =>
      slot.partySize >= r.minPartySize &&
      (!r.weekdays || r.weekdays.includes(day)) &&
      (!r.periods || r.periods.includes(slot.period)),
  );
  // When several rules apply, the guest pays the single highest rate, not a sum.
  const rule = applicable.sort((a, b) => b.perGuestMinor - a.perGuestMinor)[0] ?? null;
  if (!rule) return { amountMinor: 0, perGuestMinor: 0, rule: null };
  return { amountMinor: rule.perGuestMinor * slot.partySize, perGuestMinor: rule.perGuestMinor, rule };
}

export interface CancellationTerms {
  refundMinor: Minor;
  forfeitMinor: Minor;
  withinFreeWindow: boolean;
  freeUntil: number;
}

export function cancellationTerms(
  policy: BookingPolicy,
  startsAt: number,
  now: number,
  refundableMinor: Minor,
): CancellationTerms {
  const freeUntil = startsAt - policy.freeCancellationHours * HOUR;
  const withinFreeWindow = now <= freeUntil;
  const refundMinor = withinFreeWindow
    ? refundableMinor
    : Math.floor((refundableMinor * policy.lateCancellationRefundPercent) / 100);
  return { refundMinor, forfeitMinor: refundableMinor - refundMinor, withinFreeWindow, freeUntil };
}

export function amendableUntil(policy: BookingPolicy, startsAt: number): number {
  return startsAt - policy.amendCutoffHours * HOUR;
}

/** Plain-language policy lines shown before confirmation and in receipts. */
export function policyLines(policy: BookingPolicy, deposit: DepositQuote): string[] {
  const lines: string[] = [];
  if (deposit.amountMinor > 0) {
    lines.push(
      `A deposit of ${formatZar(deposit.perGuestMinor)} per guest (${formatZar(deposit.amountMinor)}) secures this table and comes off your bill.`,
    );
  } else {
    lines.push('No deposit is needed for this table.');
  }
  const late =
    policy.lateCancellationRefundPercent > 0
      ? `After that, ${policy.lateCancellationRefundPercent}% of the deposit is refunded.`
      : 'After that, the deposit is not refundable.';
  lines.push(
    deposit.amountMinor > 0
      ? `Cancel up to ${policy.freeCancellationHours} hours before for a full refund. ${late}`
      : `Please cancel at least ${policy.freeCancellationHours} hours before if your plans change.`,
  );
  lines.push(`We hold your table for ${policy.graceMinutes} minutes after your booking time.`);
  if (deposit.amountMinor > 0 && policy.noShowRetainsDeposit) {
    lines.push('If you do not arrive, the deposit is kept.');
  }
  lines.push(`Changes can be made online up to ${policy.amendCutoffHours} hours before.`);
  return lines;
}

/** The café's terms in general, before a particular table is chosen. */
export function branchPolicyLines(policy: BookingPolicy): string[] {
  const lines: string[] = [];
  if (policy.deposits.length === 0) {
    lines.push('No deposit is needed to book.');
  } else {
    lines.push('Some bookings need a deposit, paid when you book and taken off your bill.');
  }
  const late =
    policy.lateCancellationRefundPercent > 0
      ? `after that, ${policy.lateCancellationRefundPercent}% of a deposit is refunded`
      : 'after that, deposits are not refundable';
  lines.push(`Cancel up to ${policy.freeCancellationHours} hours before for a full refund; ${late}.`);
  lines.push(`Tables are held for ${policy.graceMinutes} minutes after the booking time.`);
  lines.push(`Online changes close ${policy.amendCutoffHours} hours before.`);
  return lines;
}
