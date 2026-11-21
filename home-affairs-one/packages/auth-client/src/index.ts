/**
 * Mock sign-in client.
 *
 * This stands in for an OpenID Connect provider and a passkey authenticator.
 * There is no password, no credential and no WebAuthn ceremony: choosing a demo
 * persona creates a session object in the browser tab. Nothing here verifies
 * anyone's identity, and the UI must never claim that it does.
 *
 * A real build replaces this file with an OIDC client; the `Session` shape and
 * the tier checks are what the rest of the app depends on.
 */
import type { Partner, PersonAccount, StaffMember } from '@hao/api-contracts';
import { ASSURANCE_TIERS, meetsTier, type AssuranceTier, type Role } from '@hao/shared-types';

export type SignInMethod = 'passkey' | 'verified-contact' | 'workforce';

export interface Session {
  role: Role;
  /** Opaque reference: a person token, staff ref or partner ref. */
  subjectRef: string;
  displayName: string;
  givenName: string;
  initials: string;
  /** The tier this session holds right now. */
  tier: AssuranceTier;
  /** The highest tier the account has been proofed to. */
  accountTier: AssuranceTier;
  method: SignInMethod;
  signedInAt: string;
  /** A step-up to A3 covers one sensitive action and then expires. */
  stepUpExpiresAt: string | null;
  synthetic: true;
}

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SESSION_KEY = 'hao.session.v1';
export const STEP_UP_MINUTES = 10;

type Listener = (session: Session | null) => void;

export interface AuthClient {
  getSession(): Session | null;
  signInCitizen(account: PersonAccount, method: Exclude<SignInMethod, 'workforce'>): Session;
  signInStaff(staff: StaffMember): Session;
  signInPartner(partner: Partner): Session;
  /**
   * Raises a verified (A2) citizen session to A3 for a short time. Refused for
   * accounts that have not been identity-proofed: they must verify first.
   */
  stepUp(): Session;
  signOut(): void;
  subscribe(listener: Listener): () => void;
}

/** A session signed in with only a verified contact never exceeds A1. */
export function tierForSignIn(accountTier: AssuranceTier, method: SignInMethod): AssuranceTier {
  if (method === 'workforce') return 'A4';
  if (method === 'verified-contact') return meetsTier(accountTier, 'A1') ? 'A1' : 'A0';
  // A passkey proves control of the account, not more identity than was proofed.
  const capped = Math.min(ASSURANCE_TIERS.indexOf(accountTier), ASSURANCE_TIERS.indexOf('A2'));
  return ASSURANCE_TIERS[capped] ?? 'A0';
}

export function createAuthClient(options: {
  storage: SessionStorageLike;
  now?: () => Date;
}): AuthClient {
  const { storage } = options;
  const now = options.now ?? (() => new Date());
  const listeners = new Set<Listener>();

  const read = (): Session | null => {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as Session;
      // An expired step-up quietly falls back to the sign-in tier.
      if (session.stepUpExpiresAt && new Date(session.stepUpExpiresAt) <= now()) {
        return {
          ...session,
          tier: tierForSignIn(session.accountTier, session.method),
          stepUpExpiresAt: null,
        };
      }
      return session;
    } catch {
      return null;
    }
  };

  const write = (session: Session | null) => {
    if (session) storage.setItem(SESSION_KEY, JSON.stringify(session));
    else storage.removeItem(SESSION_KEY);
    for (const listener of listeners) listener(session);
    return session;
  };

  return {
    getSession: read,
    signInCitizen(account, method) {
      return write({
        role: 'citizen',
        subjectRef: account.personToken,
        displayName: account.displayName,
        givenName: account.givenName,
        initials: account.initials,
        tier: tierForSignIn(account.assuranceTier, method),
        accountTier: account.assuranceTier,
        method,
        signedInAt: now().toISOString(),
        stepUpExpiresAt: null,
        synthetic: true,
      }) as Session;
    },
    signInStaff(staff) {
      return write({
        role: 'staff',
        subjectRef: staff.staffRef,
        displayName: staff.displayName,
        givenName: staff.displayName.split(' ')[0] ?? staff.displayName,
        initials: staff.initials,
        tier: 'A4',
        accountTier: 'A4',
        method: 'workforce',
        signedInAt: now().toISOString(),
        stepUpExpiresAt: null,
        synthetic: true,
      }) as Session;
    },
    signInPartner(partner) {
      return write({
        role: 'partner',
        subjectRef: partner.partnerRef,
        displayName: partner.name,
        givenName: partner.name,
        initials: partner.name.slice(0, 2).toUpperCase(),
        tier: 'A4',
        accountTier: 'A4',
        method: 'workforce',
        signedInAt: now().toISOString(),
        stepUpExpiresAt: null,
        synthetic: true,
      }) as Session;
    },
    stepUp() {
      const session = read();
      if (!session || session.role !== 'citizen') {
        throw new Error('Sign in before a step-up check.');
      }
      if (!meetsTier(session.accountTier, 'A2') || session.method !== 'passkey') {
        throw new Error('This account must be verified, and signed in with a passkey, first.');
      }
      return write({
        ...session,
        tier: 'A3',
        stepUpExpiresAt: new Date(now().getTime() + STEP_UP_MINUTES * 60_000).toISOString(),
      }) as Session;
    },
    signOut() {
      write(null);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Passkey interface stub                                              */
/* ------------------------------------------------------------------ */

/**
 * The seam where a real WebAuthn ceremony would go. The stub resolves after a
 * short pause so the UI can show the "waiting for your device" state.
 */
export interface PasskeyAuthenticator {
  readonly kind: 'stub' | 'webauthn';
  authenticate(subjectRef: string): Promise<{ verified: boolean }>;
}

export function createStubPasskeyAuthenticator(delayMs = 700): PasskeyAuthenticator {
  return {
    kind: 'stub',
    authenticate: () =>
      new Promise((resolve) => setTimeout(() => resolve({ verified: true }), delayMs)),
  };
}

export { meetsTier };
