import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from './storage';
import type { Actor } from '@/domain/guests/types';

interface SessionState {
  token: string | null;
  actor: Actor | null;
  name: string;
  email: string;
  hydrated: boolean;
  signIn(input: { token: string; actor: Actor; name: string; email: string }): void;
  signOut(): void;
  setName(name: string): void;
}

/**
 * Who is signed in. In mock mode the token is the guest id; against a live
 * server it is the session token the server issued. Either way it lives in
 * device storage only — the server re-derives role and identity from it on
 * every call and never believes the `actor` stored here.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      actor: null,
      name: '',
      email: '',
      hydrated: false,
      signIn: ({ token, actor, name, email }) => set({ token, actor, name, email }),
      signOut: () => set({ token: null, actor: null, name: '', email: '' }),
      setName: (name) => set({ name }),
    }),
    {
      name: 'mabu.session.v1',
      storage: deviceStorage,
      partialize: ({ token, actor, name, email }) => ({ token, actor, name, email }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);

export const isStaff = (actor: Actor | null) => actor?.role === 'staff' || actor?.role === 'admin';
