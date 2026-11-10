import * as Crypto from 'expo-crypto';
import {
  forgotPasswordSchema,
  ok,
  registerSchema,
  signInSchema,
  unavailable,
  type ProviderResult,
  type RegisterInput,
} from '@kc-one/contracts';
import { anyDemo } from '@kc-one/contracts';
import { capabilities } from '@/config/env';
import { useSession, type Session } from '@/state/session';
import { demoProvenance, latency } from './demo/common';

/** Demo sessions last 12 hours so session expiry is exercised on a real phone. */
const DEMO_SESSION_MS = 12 * 60 * 60_000;

export interface AuthService {
  signIn(email: string, password: string): Promise<ProviderResult<Session>>;
  register(input: RegisterInput): Promise<ProviderResult<Session>>;
  requestPasswordReset(email: string): Promise<ProviderResult<{ sent: boolean }>>;
  signOut(): Promise<void>;
  /** Placeholder for real account deletion; see docs/privacy.md. */
  requestAccountDeletion(): Promise<ProviderResult<{ requested: true }>>;
}

function demoSession(email: string, displayName: string): Session {
  const now = Date.now();
  return {
    userId: `demo-${Crypto.randomUUID()}`,
    displayName,
    email,
    isDemo: true,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEMO_SESSION_MS).toISOString(),
  };
}

/**
 * Demo sign-in. No account is created anywhere and no password is stored:
 * the form is validated with the real rules, then a local demo session starts.
 */
const demoAuth: AuthService = {
  async signIn(email, password) {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success)
      return unavailable('error', parsed.error.issues[0]?.message ?? 'Check your details.');
    const name = email.split('@')[0] ?? 'Supporter';
    return latency(ok(demoSession(email, name), demoProvenance()), 300);
  },
  async register(input) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success)
      return unavailable('error', parsed.error.issues[0]?.message ?? 'Check your details.');
    return latency(ok(demoSession(input.email, input.displayName), demoProvenance()), 300);
  },
  async requestPasswordReset(email) {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return unavailable('error', 'Enter a valid email address.');
    return latency(
      unavailable('demo_restricted', 'The demo has no accounts, so no reset email was sent.'),
    );
  },
  async signOut() {
    useSession.getState().signOut('user');
  },
  async requestAccountDeletion() {
    return latency(
      unavailable(
        'demo_restricted',
        'There is no account to delete in the demo. Use "Delete demo data on this phone" instead.',
      ),
    );
  },
};

/**
 * Live sign-in waits on the club's choice of identity provider (an open
 * decision). Until it is wired, it refuses plainly rather than pretending.
 */
const pendingAuth: AuthService = {
  signIn: async () =>
    unavailable(
      'integration_pending',
      'Sign-in opens once the club connects its identity provider.',
    ),
  register: async () =>
    unavailable(
      'integration_pending',
      'Registration opens once the club connects its identity provider.',
    ),
  requestPasswordReset: async () =>
    unavailable('integration_pending', 'Password reset opens once sign-in is connected.'),
  signOut: async () => useSession.getState().signOut('user'),
  requestAccountDeletion: async () =>
    unavailable(
      'integration_pending',
      'Account deletion requests go to the club’s privacy team once connected.',
    ),
};

export const auth: AuthService = anyDemo(capabilities) ? demoAuth : pendingAuth;
