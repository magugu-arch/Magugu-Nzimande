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

/**
 * Who somebody is, in mock mode, derived from their email address.
 *
 * A different email is a different person, and the same email twice is the
 * same person. Both halves matter and both were once wrong: `signIn` handed
 * back `demoUser` with the typed address pasted over the top, so every account
 * looked like one account, and nothing that turns on *who* is signed in could
 * be observed at all.
 *
 * Fixing that left the second half broken, in the one place nothing drives.
 * `register` minted `user-${Date.now()}` while `signIn` derived from the email,
 * so registering and later signing back in produced two different people from
 * one address:
 *
 *     registered as   user-1787754650382
 *     signed in as    user-thandi-example-co-za
 *     favourites      3 before, 0 after
 *
 * `claimFor` clears the list when the owner changes, which is right — it is
 * what stops one person inheriting another's — so a customer who registered,
 * hearted a few dishes and then signed out lost them on their first sign-out.
 * `audit:handover` exists to hold exactly that line and could not see it,
 * because it signs in rather than registering, as does every other journey.
 *
 * A real backend issues the id; this is the mock's job, and it is one function
 * now rather than two spellings of the same intention.
 */
function mockUserId(email: string): string {
  return `user-${email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;
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

  const normalised = email.trim().toLowerCase();
  const session = mockSession({
    ...demoUser,
    id: mockUserId(normalised),
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

  const email = input.email.trim().toLowerCase();
  const user: UserProfile = {
    // The same derivation `signIn` uses. It was `user-${Date.now()}`, and the
    // two disagreeing is what lost a customer their favourites — see
    // `mockUserId`.
    id: mockUserId(email),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email,
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

/**
 * Ask for the verification email to be sent again.
 *
 * The profile screen showed "Email not verified" to every newly registered
 * customer — `register` creates them that way — and offered nothing to do
 * about it. The mobile number two fields below has exactly this: a badge when
 * it is verified, a button when it is not. The email had the badge and no way
 * out of it, so the warning was permanent by construction.
 *
 * Same shape as `requestOtp`, deliberately, because that is the pattern this
 * app already uses for the same problem.
 */
export async function requestEmailVerification(email: string): Promise<{ sentTo: string }> {
  if (!config.useMockApi) {
    return request<{ sentTo: string }>('/v1/auth/email/verify', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  }
  /**
   * The mock follows the link, which is the only way this state is reachable.
   *
   * `register` creates every customer unverified and the seeded one is
   * unverified too — deliberately, because that is what almost every real
   * account looks like and the warning branches had rendered for nobody. But
   * the mock only ever returned `{ sentTo }`, so there was no path in a demo
   * build from unverified to verified at all: the success badge, and the
   * profile screen without its warning, were unreachable by construction.
   *
   * A mock kinder than the world hides defects; a mock with no exit from a
   * state hides the whole far side of it. Against a real backend the customer
   * clicks a link in their inbox and the next profile fetch says so — this is
   * that, minus the inbox.
   */
  const address = email.trim().toLowerCase();
  verifiedEmails.add(address);
  return delay({ sentTo: address }, 500);
}

/** Addresses the mock has "seen the link clicked" for. Mock-only. */
const verifiedEmails = new Set<string>();

/** Whether this address has been verified in this session. Mock-only. */
export function isEmailVerified(email: string): boolean {
  return verifiedEmails.has(email.trim().toLowerCase());
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

/**
 * The other end of the link in that email, which had no other end.
 *
 * The app told a customer "we have sent a link to reset your password", and
 * there was no screen for the link to land on: no route, so expo-router sent
 * them to `+not-found` — "This page has moved on. We couldn't find what you
 * were looking for. It may have been taken off the menu." Somebody locked out
 * of their account, told their password reset was off the menu.
 *
 * The token is whatever the backend put in the link. The app does not read it,
 * validate it or store it — it hands it back with the new password, and the
 * server decides whether it is still good. That keeps the only judgement about
 * a security token on the side that issued it.
 */
export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  if (!config.useMockApi) {
    await request<void>('/v1/auth/password/confirm', {
      method: 'POST',
      body: { token, password },
      anonymous: true,
    });
    return;
  }

  // The mock has no tokens to expire, so it refuses only what is plainly
  // unusable — an empty one, which is what a truncated link produces.
  if (token.trim().length === 0) {
    throw new Error('That reset link is not valid. Ask for a new one.');
  }
  await delay(null, 600);
}

/**
 * Ask for the account to be erased, and let a failure be a failure.
 *
 * The screen offered "Delete your account?" and promised "We remove your
 * personal data within 30 days" — and then called `signOut`. Nothing was ever
 * asked of anyone. A customer exercising their right to erasure under POPIA
 * got a sign-out and a sentence that was not true, and no record of the
 * request existed anywhere for the thirty days it named.
 *
 * Deliberately unlike `signOut`, which swallows a failed request because
 * forgetting locally is the safer outcome there. Here it is the opposite: if
 * the request did not land, the account still exists, and quietly signing
 * somebody out would tell them their data was gone when it is not. The caller
 * has to hear about it.
 *
 * In mock mode there is no server to ask, so this only clears the tokens —
 * which means the promise is still only kept once the endpoint below exists.
 * `audit:launch` says so.
 */
export async function deleteAccount(): Promise<void> {
  if (!config.useMockApi) {
    await request<void>('/v1/account', { method: 'DELETE' });
  }
  await clearTokens();
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
