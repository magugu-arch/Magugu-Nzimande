import {
  academicCalendar,
  exams,
  modules,
  progress,
  results,
  staffTimetable,
  studentTimetable,
} from '../../fixtures/academic';
import { feeTransactions, funding } from '../../fixtures/money';
import { clock } from '../../time/clock';
import type { AcademicProvider, FinanceProvider, LearningProvider } from '../contracts';
import { AdapterError } from '../errors';
import { requireUser, simulate } from '../runtime';
import { studentFeeAccount } from './identity';
import { nextId, reference, roleOf, state } from './state';

const requireRole = (domain: 'academic' | 'finance', ...roles: string[]) => {
  const userId = requireUser(domain);
  if (!roles.includes(roleOf(userId))) throw new AdapterError('forbidden', domain);
  return userId;
};

export const mockAcademic: AcademicProvider = {
  getTimetable: ({ from, to }) =>
    simulate('academic', () => {
      requireRole('academic', 'student');
      return studentTimetable(new Date(from), new Date(to), clock.now());
    }),
  getTeachingTimetable: ({ from, to }) =>
    simulate('academic', () => {
      requireRole('academic', 'staff');
      return staffTimetable(new Date(from), new Date(to), clock.now());
    }),
  getExams: () =>
    simulate('academic', () => {
      requireRole('academic', 'student');
      return exams(clock.now());
    }),
  getResults: () =>
    simulate('academic', () => {
      requireRole('academic', 'student');
      return results(clock.now());
    }),
  getProgress: () =>
    simulate('academic', () => {
      requireRole('academic', 'student');
      return progress;
    }),
  getModules: () =>
    simulate('academic', () => {
      requireRole('academic', 'student');
      return modules;
    }),
  getAcademicCalendar: () =>
    simulate('academic', () => {
      requireUser('academic');
      return academicCalendar(clock.now());
    }),
};

export const mockLearning: LearningProvider = {
  // The LMS is not connected in the prototype, so links carry no URL and the
  // UI shows them as unavailable rather than opening a made-up address.
  getLinks: (moduleCode) =>
    simulate('learning', () => [
      { moduleCode, label: 'Course page', url: null },
      { moduleCode, label: 'Lecture recordings', url: null },
      { moduleCode, label: 'Submit an assignment', url: null },
    ]),
};

export const mockFinance: FinanceProvider = {
  getAccount: () =>
    simulate('finance', () => {
      requireRole('finance', 'student');
      return studentFeeAccount();
    }),

  getTransactions: () =>
    simulate('finance', () => {
      requireRole('finance', 'student');
      const paid = Object.values(state.receipts)
        .filter((r) => r.description.startsWith('Fee payment'))
        .map((r) => ({
          id: r.id,
          date: r.paidAt,
          description: 'Payment — thank you',
          amount: { cents: -r.amount.cents, currency: 'ZAR' as const },
          kind: 'payment' as const,
          reference: r.reference,
        }));
      return [...paid, ...feeTransactions(clock.now())];
    }),

  getFunding: () =>
    simulate('finance', () => {
      requireRole('finance', 'student');
      return funding(clock.now());
    }),

  createPayment: ({ amount, method, purpose }) =>
    simulate('finance', () => {
      requireUser('finance');
      if (purpose === 'fees') requireRole('finance', 'student');
      if (amount.cents <= 0) throw new AdapterError('invalid', 'finance', 'Amount must be positive');
      const intent = {
        id: nextId('pay'),
        amount,
        method,
        purpose,
        status: 'awaiting-handoff' as const,
        createdAt: clock.now().toISOString(),
      };
      state.payments[intent.id] = intent;
      return intent;
    }),

  /**
   * The mock gateway always approves. In live mode the BFF confirms with the
   * provider's server-to-server callback before this resolves.
   */
  confirmPayment: (paymentId) =>
    simulate('finance', () => {
      requireUser('finance');
      const intent = state.payments[paymentId];
      if (!intent) throw new AdapterError('not-found', 'finance');
      if (intent.status === 'succeeded') {
        const existing = Object.values(state.receipts).find((r) => r.paymentId === paymentId);
        if (existing) return existing;
      }
      intent.status = 'succeeded';
      const receipt = {
        id: nextId('rcpt'),
        paymentId,
        amount: intent.amount,
        method: intent.method,
        paidAt: clock.now().toISOString(),
        reference: reference('NMU'),
        description: {
          fees: 'Fee payment',
          order: 'Campus order',
          ticket: 'Event ticket',
          donation: 'Donation',
        }[intent.purpose],
      };
      state.receipts[receipt.id] = receipt;
      if (intent.purpose === 'fees') state.feePaymentsCents += intent.amount.cents;
      return receipt;
    }, { latencyMs: 1100 }),

  getReceipt: (receiptId) =>
    simulate('finance', () => {
      const r = state.receipts[receiptId];
      if (!r) throw new AdapterError('not-found', 'finance');
      return r;
    }),
};
