import { create } from 'zustand';
import { config } from '@/core/config';
import type { AuthSession, PersonaId } from '@/core/adapters/contracts';
import { isAdapterError } from '@/core/adapters/errors';
import { setAccessTokenSource } from '@/core/adapters/live';
import { providers } from '@/core/adapters/registry';
import { providerContext } from '@/core/adapters/runtime';
import type { Role, User } from '@/core/domain/models';
import { clock } from '@/core/time/clock';
import { secureStorage } from '@/services/secureStorage';
import { recordAudit, useGovernance } from './governance';

/**
 * The signed-in identity — brief §15: "SSO → Verify → Role access → Service
 * access → Protect".
 *
 * Tokens live only in secure storage and in this store's memory; nothing
 * else in the app can read them. Sessions expire (brief §24); an expired one
 * is cleared and the person is told why on the sign-in screen.
 */

const STORAGE_KEY = 'nmu-one.session.v1';

export type SessionStatus = 'restoring' | 'signed-out' | 'signing-in' | 'signed-in';

interface SessionState {
  status: SessionStatus;
  session: AuthSession | null;
  user: User | null;
  /** The role the experience is shaped around, from the user's roles. */
  role: Role | null;
  /** Why the person was last signed out, shown once on the sign-in screen. */
  signOutReason: 'expired' | 'error' | null;
  restore(): Promise<void>;
  signIn(persona?: PersonaId): Promise<void>;
  signOut(reason?: 'user' | 'expired'): Promise<void>;
  switchRole(role: Role): void;
  graduate(): Promise<void>;
  checkExpiry(): void;
}

function bind(user: User | null, role: Role | null) {
  providerContext.set({ userId: user?.id ?? null, role });
}

async function persist(session: AuthSession, user: User, role: Role) {
  await secureStorage.set(STORAGE_KEY, JSON.stringify({ session, user, role }));
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'restoring',
  session: null,
  user: null,
  role: null,
  signOutReason: null,

  async restore() {
    // Mock sessions are not restored: the synthetic back end resets on every
    // launch, so each demo starts from the same story. Live sessions are.
    const raw = config.dataMode === 'live' ? await secureStorage.get(STORAGE_KEY) : null;
    if (!raw) {
      set({ status: 'signed-out' });
      return;
    }
    try {
      const saved = JSON.parse(raw) as { session: AuthSession; user: User; role: Role };
      if (new Date(saved.session.expiresAt) <= clock.now()) {
        await secureStorage.remove(STORAGE_KEY);
        set({ status: 'signed-out', signOutReason: 'expired' });
        return;
      }
      bind(saved.user, saved.role);
      set({ status: 'signed-in', session: saved.session, user: saved.user, role: saved.role });
    } catch {
      await secureStorage.remove(STORAGE_KEY);
      set({ status: 'signed-out' });
    }
  },

  async signIn(persona) {
    set({ status: 'signing-in', signOutReason: null });
    try {
      const { session, user } = await providers.auth.signIn(persona);
      // Brief §4 "role selection or inferred role": one role is inferred; a
      // person with several starts in the first and can switch in Profile.
      const role = user.roles[0] ?? 'student';
      bind(user, role);
      await persist(session, user, role);
      set({ status: 'signed-in', session, user, role });
      recordAudit('auth.sign-in', user.id, `Signed in as ${role} via NMU SSO`);
    } catch (e) {
      bind(null, null);
      set({ status: 'signed-out', signOutReason: 'error' });
      throw e;
    }
  },

  async signOut(reason = 'user') {
    const { session, user } = get();
    if (session) {
      try {
        await providers.auth.signOut(session);
      } catch {
        // Signing out locally must never depend on the network.
      }
    }
    if (user) {
      recordAudit(
        reason === 'expired' ? 'auth.session-expired' : 'auth.sign-out',
        user.id,
        reason === 'expired' ? 'Session expired' : 'Signed out',
      );
    }
    await secureStorage.remove(STORAGE_KEY);
    bind(null, null);
    // A shared phone must not show the next person this one's consents or
    // audit trail. The BFF keeps the authoritative copy in live mode.
    clearPersonalState();
    set({
      status: 'signed-out',
      session: null,
      user: null,
      role: null,
      signOutReason: reason === 'expired' ? 'expired' : null,
    });
  },

  switchRole(role) {
    const { user, session } = get();
    if (!user || !session || !user.roles.includes(role)) return;
    bind(user, role);
    set({ role });
    void persist(session, user, role);
    recordAudit('role.switch', user.id, `Switched to ${role}`);
  },

  /**
   * Student → Alumni without a new identity (brief §14). The id, sign-in and
   * session carry over; only roles and lifecycle change.
   */
  async graduate() {
    const { user, session } = get();
    if (!user || !session) return;
    const next = await providers.auth.transitionToAlumni(user.id);
    bind(next, 'alumni');
    set({ user: next, role: 'alumni' });
    await persist(session, next, 'alumni');
    recordAudit('lifecycle.transition', user.id, 'Student → Alumni (same identity)');
  },

  checkExpiry() {
    const { session, status } = get();
    if (status === 'signed-in' && session && new Date(session.expiresAt) <= clock.now()) {
      void get().signOut('expired');
    }
  },
}));

setAccessTokenSource(() => useSession.getState().session?.accessToken ?? null);

/** Resets everything tied to a person, for sign-out and tests. */
export function clearPersonalState() {
  useGovernance.getState().reset();
}

export const errorKind = (e: unknown) => (isAdapterError(e) ? e.kind : 'unavailable');
