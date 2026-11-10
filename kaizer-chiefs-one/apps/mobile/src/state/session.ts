import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { plainStorage, secureStorage } from './storage';

export interface Session {
  userId: string;
  displayName: string;
  email: string;
  /** True for the local demo sign-in: no account exists anywhere. */
  isDemo: boolean;
  issuedAt: string;
  expiresAt: string;
}

interface SessionState {
  session: Session | null;
  /** Set when a session ends because it expired, so the UI can say why. */
  expiredNotice: boolean;
  setSession: (s: Session) => void;
  signOut: (reason?: 'user' | 'expired') => void;
  clearExpiredNotice: () => void;
  hydrated: boolean;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      expiredNotice: false,
      hydrated: false,
      setSession: (session) => set({ session, expiredNotice: false }),
      signOut: (reason = 'user') => set({ session: null, expiredNotice: reason === 'expired' }),
      clearExpiredNotice: () => set({ expiredNotice: false }),
    }),
    {
      name: 'kc1.session',
      storage: secureStorage,
      partialize: (s) => ({ session: s.session }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);

export function isExpired(s: Session, now = new Date()): boolean {
  return new Date(s.expiresAt).getTime() <= now.getTime();
}

interface OnboardingState {
  completed: boolean;
  /** Browsing without an account. Account-only screens ask to sign in. */
  guest: boolean;
  hydrated: boolean;
  finish: (mode: 'guest' | 'account') => void;
  reset: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      guest: false,
      hydrated: false,
      finish: (mode) => set({ completed: true, guest: mode === 'guest' }),
      reset: () => set({ completed: false, guest: false }),
    }),
    {
      name: 'kc1.onboarding',
      storage: plainStorage,
      partialize: (s) => ({ completed: s.completed, guest: s.guest }),
      onRehydrateStorage: () => () => useOnboarding.setState({ hydrated: true }),
    },
  ),
);
