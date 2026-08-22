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

  const session = mockSession({ ...demoUser, email: email.trim().toLowerCase() });
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

export async function updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  if (!config.useMockApi) {
    return request<UserProfile>('/v1/account/profile', { method: 'PATCH', body: patch });
  }
  return delay({ ...demoUser, ...patch }, 400);
}
