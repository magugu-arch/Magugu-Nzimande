'use client';

import type { Partner, PersonAccount, StaffMember } from '@hao/api-contracts';
import {
  createAuthClient,
  type AuthClient,
  type Session,
  type SignInMethod,
} from '@hao/auth-client';
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { getGateway } from './gateway';
import { useHydrated } from './hydration';

interface SessionContextValue {
  /** `null` while signed out. Check `ready` first: before it is true the session is unknown. */
  session: Session | null;
  /** False during server rendering and hydration. */
  ready: boolean;
  signInCitizen(account: PersonAccount, method: Exclude<SignInMethod, 'workforce'>): Session;
  signInStaff(staff: StaffMember): Session;
  signInPartner(partner: Partner): Session;
  /** Raises a verified session to A3 for a short window (10 minutes). Throws if not allowed. */
  stepUp(): Session;
  signOut(): void;
}

/* The session lives in this tab's sessionStorage. A tiny external store keeps
   React in step with it without setting state from an effect. */
let client: AuthClient | null = null;
let current: Session | null = null;
const listeners = new Set<() => void>();

function syncActor(session: Session | null) {
  // Audit events carry this opaque reference, never a name.
  getGateway().setActor(session ? { role: session.role, ref: session.subjectRef } : null);
}

function auth(): AuthClient {
  if (!client) {
    client = createAuthClient({ storage: window.sessionStorage });
    current = client.getSession();
    syncActor(current);
    client.subscribe((next) => {
      current = next;
      syncActor(next);
      for (const listener of listeners) listener();
    });
  }
  return client;
}

function subscribe(listener: () => void) {
  auth();
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function getSnapshot(): Session | null {
  const active = auth();
  // A step-up is time-limited: once it lapses, fall back to the sign-in tier.
  if (current?.stepUpExpiresAt && new Date(current.stepUpExpiresAt).getTime() <= Date.now()) {
    current = active.getSession();
  }
  return current;
}

const getServerSnapshot = () => null;

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useHydrated();

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      ready,
      signInCitizen: (account, method) => auth().signInCitizen(account, method),
      signInStaff: (staff) => auth().signInStaff(staff),
      signInPartner: (partner) => auth().signInPartner(partner),
      stepUp: () => auth().stepUp(),
      signOut: () => auth().signOut(),
    }),
    [session, ready],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}

/** The signed-in citizen's person token, or `null`. */
export function usePersonToken(): string | null {
  const { session } = useSession();
  return session?.role === 'citizen' ? session.subjectRef : null;
}
