import { config } from '@/constants/config';
import type { AuthSession, UserProfile } from '@/types';
import { toE164 } from '@/utils/validation';
import { delay, request } from './apiClient';
import { demoUser } from './data/accountData';
import { clearTokens, storeTokens } from './secureStorage';

/**
 * Authentication service.
 *
 * Mock mode issues a local session so the whole journey is walkable without a
 * backend. The token handling path is identical either way, so nothing about
 * the screens changes when the real endpoints are wired in.
 */

export interface SignInInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  marketingConsent: boolean;
}

function initialsFor(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function mockSession(user: UserProfile): AuthSession {
  return {
    accessToken: `mock-access-${user.id}`,
    refreshToken: `mock-refresh-${user.id}`,
    expiresAt: Date.now() + 3_600_000,
    user,
  };
}

async function persist(session: AuthSession): Promise<AuthSession> {
  await storeTokens(session.accessToken, session.refreshToken);
  return session;
}

export async function signIn({ email, password }: SignInInput): Promise<AuthSession> {
  if (!config.useMockApi) {
    const session = await request<AuthSession>('/v1/auth/sign-in', {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    });
    return persist(session);
  }

  if (password.length < 8) {
    throw new Error('That email and password combination does not match our records.');
  }

  /**
   * A different email is a different person, even in mock mode.
   *
   * This handed back `demoUser` with the typed address pasted over the top, so
   * every sign-in produced the same `user.id` — one identity wearing whatever
   * email the tester happened to enter. Anything that turns on *who* is signed
   * in was therefore unobservable here: favourites belonging to an account,
   * order history, a handset passed from one person to another. Two accounts
   * looked like one, so nothing could tell them apart to get it wrong.
   *
   * Derived from the email rather than random, so signing in twice as the same
   * person is the same person — which is the other half of what has to be
   * true.
   */
  const normalised = email.trim().toLowerCase();
  const session = mockSession({
    ...demoUser,
    id: `user-${normalised.replace(/[^a-z0-9]+/g, '-')}`,
    email: normalised,
  });
  await delay(null, 600);
  return persist(session);
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  if (!config.useMockApi) {
    const session = await request<AuthSession>('/v1/auth/register', {
      method: 'POST',
      body: { ...input, phone: toE164(input.phone) },
      anonymous: true,
    });
    return persist(session);
  }

  const user: UserProfile = {
    id: `user-${Date.now()}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: toE164(input.phone),
    avatarInitials: initialsFor(input.firstName, input.lastName),
    isGuest: false,
    emailVerified: false,
    // Verified in the OTP step that follows registration.
    phoneVerified: false,
    createdAt: new Date().toISOString(),
  };

  await delay(null, 700);
  return persist(mockSession(user));
}

/** Request an OTP. Mock mode always uses 1234 and says so on screen. */
export async function requestOtp(phone: string): Promise<{ sentTo: string }> {
  if (!config.useMockApi) {
    return request<{ sentTo: string }>('/v1/auth/otp/request', {
      method: 'POST',
      body: { phone: toE164(phone) },
      anonymous: true,
    });
  }
  return delay({ sentTo: toE164(phone) }, 500);
}

export async function verifyOtp(phone: string, code: string): Promise<{ verified: true }> {
  if (!config.useMockApi) {
    return request<{ verified: true }>('/v1/auth/otp/verify', {
      method: 'POST',
      body: { phone: toE164(phone), code },
      anonymous: true,
    });
  }

  await delay(null, 500);
  if (code !== MOCK_OTP) throw new Error('That code is not right. Check the SMS and try again.');
  return { verified: true };
}

export const MOCK_OTP = '1234';

/** Guest sessions carry no token — checkout collects contact details instead. */
export function createGuestUser(): UserProfile {
  return {
    id: `guest-${Date.now()}`,
    firstName: 'Guest',
    lastName: '',
    email: '',
    phone: '',
    avatarInitials: 'G',
    isGuest: true,
    emailVerified: false,
    phoneVerified: false,
    createdAt: new Date().toISOString(),
  };
}

export async function requestPasswordReset(email: string): Promise<{ sentTo: string }> {
  if (!config.useMockApi) {
    return request<{ sentTo: string }>('/v1/auth/password/reset', {
      method: 'POST',
      body: { email },
      anonymous: true,
    });
  }
  return delay({ sentTo: email.trim().toLowerCase() }, 500);
}

export async function signOut(): Promise<void> {
  if (!config.useMockApi) {
    try {
      await request<void>('/v1/auth/sign-out', { method: 'POST' });
    } catch {
      // Local sign-out must succeed even when the network call does not.
    }
  }
  await clearTokens();
}

/**
 * `signedInAs` is who the patch applies to, and it is passed in rather than
 * remembered here.
 *
 * The mock has no token to read an identity off, so it merged the patch onto
 * `demoUser` — saving a phone number handed back the seeded customer's id and
 * email, and the profile screen writes that straight into the auth store:
 *
 *     signed in as : user-sipho-example-co-za  sipho@example.co.za
 *     after editing: user-demo                 thandi@example.co.za
 *
 * Changing your phone number changed who you were.
 *
 * Holding the signed-in user in module state here looked like the fix and was
 * not: it is empty after any restart, so the first profile edit on a freshly
 * opened app fell back to the seed anyway. Driven in a browser, where every
 * navigation reloads the bundle, it kept coming back as `user-demo`. The
 * caller already has the user; asking for it removes the guess.
 *
 * The real branch ignores it — a backend reads the identity off the access
 * token, which is the only thing that should ever decide it.
 */
export async function updateProfile(
  patch: Partial<UserProfile>,
  signedInAs: UserProfile,
): Promise<UserProfile> {
  /**
   * Normalised here rather than in the screen, so both callers and both
   * branches agree.
   *
   * `register` sends `toE164(input.phone)` and this sent whatever was typed,
   * so the same customer's number was stored as "+27821234567" when they
   * signed up and "0829998877" when they edited it — two formats for one field,
   * on the number a driver phones from outside the gate.
   */
  const normalised: Partial<UserProfile> = {
    ...patch,
    ...(patch.phone ? { phone: toE164(patch.phone) } : {}),
  };

  if (!config.useMockApi) {
    return request<UserProfile>('/v1/account/profile', { method: 'PATCH', body: normalised });
  }

  /**
   * Merged onto whoever is actually signed in, which is not the same thing as
   * merging onto the seed.
   *
   * This returned `{ ...demoUser, ...patch }`, so saving a new phone number
   * handed back the seeded customer's identity with the patch on top — and the
   * profile screen writes the result straight into the auth store:
   *
   *     signed in as : user-sipho-example-co-za  sipho@example.co.za
   *     after editing: user-demo                 thandi@example.co.za
   *
   * Changing your phone number changed who you were. The account screen then
   * showed somebody else's email as yours, and because the id had moved, the
   * next sign-in looked like a different person and cleared the favourites
   * that had just been made to follow their owner.
   *
   * The id is held back from the patch on purpose. A customer may edit their
   * email; nobody edits their way into being another account.
   */
  // The id is held back from the patch on purpose. A customer may edit their
  // email; nobody edits their way into being another account.
  const { id: _ignored, ...editable } = normalised;
  return delay({ ...signedInAs, ...editable }, 400);
}
