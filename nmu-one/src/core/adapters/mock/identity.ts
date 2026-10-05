import { config } from '../../config';
import type { FeeAccount } from '../../domain/models';
import { academicCalendar } from '../../fixtures/academic';
import { feeAsAt, feeDueDate, feeTransactions } from '../../fixtures/money';
import { parentProfile, personas, staffProfile, studentProfile } from '../../fixtures/people';
import { guardianUpdates, mentoringNotification, notificationsFor } from '../../fixtures/community';
import { clock } from '../../time/clock';
import { addDays, addMinutes } from '../../time/sast';
import type { AuthProvider, AuthSession, GuardianProvider } from '../contracts';
import { AdapterError } from '../errors';
import { providerContext, requireUser, simulate } from '../runtime';
import { deliver, later, state } from './state';

const token = () => `demo.${Math.random().toString(36).slice(2)}.${Date.now().toString(36)}`;

const newSession = (userId: string): AuthSession => ({
  accessToken: token(),
  refreshToken: token(),
  expiresAt: addMinutes(clock.now(), config.sessionMinutes).toISOString(),
  userId,
});

export const ceremonyDate = () =>
  academicCalendar(clock.now()).find((d) => d.kind === 'ceremony')?.date ??
  addDays(clock.now(), 9).toISOString();

export const mockAuth: AuthProvider = {
  signIn: (persona = 'student') =>
    simulate(
      'auth',
      () => {
        const user = state.users[personas[persona].id]!;
        return { session: newSession(user.id), user };
      },
      { latencyMs: 900 },
    ),

  // The demo signs in by persona; a code exchange needs a real identity provider.
  exchangeCode: () =>
    simulate('auth', () => {
      throw new AdapterError('not-configured', 'auth', 'Code exchange needs NMU SSO (live mode)');
    }),

  refresh: (session) =>
    simulate('auth', () => {
      if (!state.users[session.userId]) throw new AdapterError('unauthorised', 'auth');
      return newSession(session.userId);
    }),

  signOut: () => simulate('auth', () => undefined, { latencyMs: 150 }),

  getStudentProfile: (userId) =>
    simulate('auth', () => {
      if (userId !== personas.student.id) throw new AdapterError('not-found', 'auth');
      return studentProfile(ceremonyDate());
    }),

  getStaffProfile: (userId) =>
    simulate('auth', () => {
      if (userId !== personas.staff.id) throw new AdapterError('not-found', 'auth');
      return staffProfile;
    }),

  /**
   * Brief §14: "Do not force the user to create a new identity after
   * graduation." Same user id, same sign-in; the role and lifecycle move on.
   */
  transitionToAlumni: (userId) =>
    simulate(
      'auth',
      () => {
        const user = state.users[userId];
        if (!user) throw new AdapterError('not-found', 'auth');
        if (user.lifecycle !== 'student')
          throw new AdapterError('conflict', 'auth', 'Not a student');
        user.roles = ['alumni'];
        user.lifecycle = 'alumni';
        const now = clock.now();
        const signedIn = () => providerContext.get().userId;
        const [welcome] = notificationsFor('graduate', now);
        if (welcome) deliver(userId, welcome, signedIn());
        // The mentoring opportunity arrives a little later (brief §26 step 13).
        later(8_000, () => deliver(userId, mentoringNotification(clock.now()), signedIn()));
        return user;
      },
      { latencyMs: 1200 },
    ),
};

/** The demo student's fee account, as Student Finance would report it. */
export function studentFeeAccount(): FeeAccount {
  const now = clock.now();
  const owed =
    feeTransactions(now).reduce((sum, t) => sum + t.amount.cents, 0) - state.feePaymentsCents;
  return {
    accountId: 'fa-0417',
    balance: { cents: owed, currency: 'ZAR' },
    dueDate: owed > 0 ? feeDueDate(now) : null,
    status: owed > 0 ? 'current' : owed < 0 ? 'credit' : 'settled',
    asAt: state.feePaymentsCents > 0 ? now.toISOString() : feeAsAt(now),
  };
}

const requireParent = () => {
  const userId = requireUser('guardian');
  if (userId !== personas.parent.id) throw new AdapterError('forbidden', 'guardian');
  return userId;
};

const profileNow = () =>
  parentProfile(addDays(clock.now(), -30).toISOString(), state.guardianSharing);

const linked = (studentId: string) => {
  const profile = profileNow();
  const student = profile.linkedStudents.find((s) => s.studentId === studentId);
  if (!student) throw new AdapterError('forbidden', 'guardian', 'Not a linked student');
  return student;
};

export const mockGuardian: GuardianProvider = {
  getProfile: () =>
    simulate('guardian', () => {
      requireParent();
      return profileNow();
    }),

  getUpdates: (studentId) =>
    simulate('guardian', () => {
      requireParent();
      const student = linked(studentId);
      // Filtered at the source: an ungranted scope never leaves the "server".
      return guardianUpdates(clock.now(), studentId).filter((u) =>
        student.sharing.includes(u.scope),
      );
    }),

  getStudentAccount: (studentId) =>
    simulate('guardian', () => {
      requireParent();
      if (!linked(studentId).sharing.includes('fees')) {
        throw new AdapterError('forbidden', 'guardian', 'Fees not shared');
      }
      return studentFeeAccount();
    }),

  getMyGuardians: () =>
    simulate('guardian', () => {
      const userId = requireUser('guardian');
      if (userId !== personas.student.id) return [];
      return [
        {
          guardianId: personas.parent.id,
          name: `${personas.parent.givenName} ${personas.parent.familyName}`,
          relationship: 'parent' as const,
          sharing: state.guardianSharing,
        },
      ];
    }),

  setGuardianSharing: (guardianId, sharing) =>
    simulate('guardian', () => {
      const userId = requireUser('guardian');
      if (userId !== personas.student.id || guardianId !== personas.parent.id) {
        throw new AdapterError('forbidden', 'guardian');
      }
      state.guardianSharing = [...new Set(sharing)];
      return {
        guardianId,
        name: `${personas.parent.givenName} ${personas.parent.familyName}`,
        relationship: 'parent' as const,
        sharing: state.guardianSharing,
      };
    }),
};
