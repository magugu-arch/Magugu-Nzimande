/**
 * SYNTHETIC DEMO DATA. Amounts, references and funding states are invented to
 * demonstrate the experience; they are not NMU fees or NSFAS rules. The
 * statement sums to the balance so the demo never contradicts itself.
 */
import type { FeeTransaction, FundingStatus } from '../domain/models';
import { zar } from '../domain/money';
import { addDays, addMinutes, sastDate, sastParts } from '../time/sast';

export function feeTransactions(now: Date): FeeTransaction[] {
  const { year } = sastParts(now);
  const on = (month: number, day: number) => sastDate(year, month, day, 9).toISOString();
  return [
    { id: 't1', date: on(1, 20), description: `Tuition ${year}`, amount: zar(58_400), kind: 'charge', reference: 'TUI-0417' },
    { id: 't2', date: on(1, 20), description: `Residence ${year}`, amount: zar(32_600), kind: 'charge', reference: 'RES-0417' },
    { id: 't3', date: on(1, 20), description: 'Registration fee', amount: zar(6_250), kind: 'charge', reference: 'REG-0417' },
    { id: 't4', date: on(3, 14), description: 'NSFAS tuition', amount: zar(-58_400), kind: 'funding', reference: 'NSF-T-0417' },
    { id: 't5', date: on(3, 14), description: 'NSFAS accommodation', amount: zar(-32_600), kind: 'funding', reference: 'NSF-A-0417' },
    { id: 't6', date: on(2, 6), description: 'Payment — thank you', amount: zar(-2_000), kind: 'payment', reference: 'PAY-88213' },
  ].sort((a, b) => b.date.localeCompare(a.date)) as FeeTransaction[];
}

export const feeDueDate = (now: Date) => {
  const p = sastParts(addDays(now, 25));
  return sastDate(p.year, p.month, p.day, 23, 59).toISOString();
};

/** When the statement was last refreshed from the finance system. */
export const feeAsAt = (now: Date) => addMinutes(now, -58).toISOString();

export function funding(now: Date): FundingStatus {
  const { year } = sastParts(now);
  return {
    provider: 'nsfas',
    providerName: 'NSFAS',
    status: 'delayed',
    headline: 'October living allowance delayed',
    detail:
      'NSFAS has not yet released your October living allowance. Your tuition and accommodation are covered. Student Funding will update this page — and notify you — as soon as the payment moves.',
    expectedBy: null,
    updatedAt: addMinutes(now, -40).toISOString(),
    allowances: [
      { label: 'Tuition', amount: zar(58_400), status: 'paid' },
      { label: 'Accommodation', amount: zar(32_600), status: 'paid' },
      { label: `Learning materials ${year}`, amount: zar(5_460), status: 'paid' },
      { label: 'Living allowance — September', amount: zar(1_650), status: 'paid' },
      { label: 'Living allowance — October', amount: zar(1_650), status: 'delayed' },
    ],
  };
}
