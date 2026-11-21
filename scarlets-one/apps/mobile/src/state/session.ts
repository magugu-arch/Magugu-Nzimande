import type { Account } from '@scarlets/adapters';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePrefs } from './prefs';
import { persistStorage } from './storage';

/**
 * DEMO SESSION. There is no real sign-in in this build: the two demo accounts
 * stand in for the club's identity provider (Supabase Auth or its approved
 * equivalent). No credential is collected or stored.
 */
export type DemoAccount = 'guest' | 'supporter' | 'member';

interface SessionState {
  account: DemoAccount;
  signIn: (account: Exclude<DemoAccount, 'guest'>) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      account: 'guest',
      signIn: (account) => set({ account }),
      signOut: () => set({ account: 'guest' }),
    }),
    { name: 'scarlets:session', storage: persistStorage },
  ),
);

export function toAccount(account: DemoAccount, deviceId: string): Account {
  if (account === 'guest') return { state: 'guest', userId: null, deviceId, member: false };
  return {
    state: 'signed_in',
    userId: account === 'member' ? 'demo-member' : 'demo-supporter',
    deviceId,
    member: account === 'member',
  };
}

export function useAccount(): Account {
  const account = useSession((s) => s.account);
  const deviceId = usePrefs((s) => s.deviceId);
  return toAccount(account, deviceId);
}
