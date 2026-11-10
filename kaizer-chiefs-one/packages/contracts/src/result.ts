import type { Provenance } from './provenance';

/**
 * Why a provider could not answer. Each reason maps to an honest,
 * specific message in the UI; none of them may be rendered as success.
 */
export const UNAVAILABLE_REASONS = [
  /** The club has not yet chosen or connected this provider. */
  'integration_pending',
  /** A provider is chosen but this build lacks its configuration. */
  'not_configured',
  /** The device is offline and nothing usable is cached. */
  'offline',
  /** The provider answered with an error. */
  'error',
  /** The feature needs a signed-in supporter. */
  'not_authenticated',
  /** Signed in, but not eligible (e.g. not a verified member). */
  'not_eligible',
  /** The action would claim a real-world outcome, which demo mode never does. */
  'demo_restricted',
] as const;
export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

export type ProviderResult<T> =
  | { status: 'ok'; data: T; provenance: Provenance }
  | { status: 'unavailable'; reason: UnavailableReason; message: string };

export function ok<T>(data: T, provenance: Provenance): ProviderResult<T> {
  return { status: 'ok', data, provenance };
}

export function unavailable<T = never>(
  reason: UnavailableReason,
  message: string,
): ProviderResult<T> {
  return { status: 'unavailable', reason, message };
}

/** Default supporter-facing copy for each reason. Screens may add context. */
export const UNAVAILABLE_COPY: Record<UnavailableReason, { title: string; body: string }> = {
  integration_pending: {
    title: 'Not connected yet',
    body: 'This feature will show official club information once the club connects its provider.',
  },
  not_configured: {
    title: 'Not available in this build',
    body: 'This build is missing the settings this feature needs.',
  },
  offline: {
    title: "You're offline",
    body: 'Reconnect to load this. Nothing here is shown from an old copy without saying so.',
  },
  error: {
    title: "Couldn't load this",
    body: 'The service did not respond as expected. Try again in a moment.',
  },
  not_authenticated: {
    title: 'Sign in to continue',
    body: 'This part of the app belongs to your supporter account.',
  },
  not_eligible: {
    title: 'Not available for this account',
    body: 'Your account is not eligible for this yet.',
  },
  demo_restricted: {
    title: 'Not available in the demo',
    body: 'The demo never issues tickets, confirms payments or redeems rewards.',
  },
};
