import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { config } from '@/constants/config';
import { colors } from '@/theme';
import { request } from './apiClient';

/**
 * Push notifications (brief §3).
 *
 * Registration is best-effort by design. Notifications are a convenience, not
 * a prerequisite for ordering, so every failure path here returns a reason
 * rather than throwing — a customer who declines the prompt, or is on a
 * simulator, must still get a working app.
 *
 * Remote push requires a development build; Expo Go dropped support in SDK 53.
 * `registerForPushNotifications` reports that as a plain outcome so the
 * Preferences screen can explain it instead of silently doing nothing.
 */

export type PushRegistrationOutcome =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; reason: string };

/** How a notification behaves when it lands while the app is foregrounded. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // Order updates matter mid-session — a customer watching the tracking
      // screen should still see "your driver is here".
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Android requires channels or notifications post silently with no heads-up.
 * Order updates get their own channel so a customer can mute marketing without
 * muting "your food is here".
 */
export async function configureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Order updates',
    description: 'Status changes, driver on the way, ready to collect.',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.primary,
    vibrationPattern: [0, 250, 250, 250],
  });

  await Notifications.setNotificationChannelAsync('promotions', {
    name: 'Offers and rewards',
    description: 'Deals, members-only drops and reward reminders.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: colors.primary,
  });
}

function resolveProjectId(): string | null {
  if (config.push.projectId.length > 0) return config.push.projectId;
  const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  // The template placeholder is not a real project.
  if (typeof easProjectId === 'string' && !easProjectId.startsWith('00000000')) {
    return easProjectId;
  }
  return null;
}

export async function registerForPushNotifications(): Promise<PushRegistrationOutcome> {
  if (Constants.appOwnership === 'expo') {
    return {
      status: 'unsupported',
      reason: 'Remote push needs a development build — Expo Go cannot receive it.',
    };
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }

    if (!granted) return { status: 'denied' };

    await configureAndroidChannels();

    const projectId = resolveProjectId();
    if (!projectId) {
      return {
        status: 'unsupported',
        reason: 'No EAS project id configured. Set EXPO_PUBLIC_PUSH_PROJECT_ID.',
      };
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: token.data };
  } catch (error) {
    return {
      status: 'error',
      reason: error instanceof Error ? error.message : 'Could not register for notifications.',
    };
  }
}

/**
 * Hand the token to the backend so it can target this device.
 *
 * Swallows failure: a customer must never see an error because a push token
 * did not sync. The next launch tries again.
 */
/**
 * The token this device last told the server about.
 *
 * Held here rather than in a store because it is not UI state and nobody
 * renders it — sign-out is the only thing that needs it back, and it needs it
 * at a moment when the screen that registered it is long gone.
 */
let lastSyncedToken: string | null = null;

export async function syncPushToken(token: string): Promise<boolean> {
  if (config.useMockApi) {
    lastSyncedToken = token;
    return true;
  }

  try {
    await request<void>('/v1/account/push-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS },
    });
    lastSyncedToken = token;
    return true;
  } catch {
    return false;
  }
}

/**
 * Unbind this handset from the account that is signing out.
 *
 * `syncPushToken` registers the device against whoever is signed in, and
 * nothing undid it. Signing out cleared the app's own memory of a person —
 * their address, their basket, their cached history — and left the server
 * still sending that person's push to this handset. On a phone that has been
 * shared, handed down or sold, the next owner reads "Your order BBQ-4823 is on
 * its way" for an order that is not theirs, complete with the reference.
 *
 * Best-effort on purpose, and it must run before the session is torn down,
 * while the request can still authenticate. A failure here cannot be allowed
 * to keep someone signed in.
 */
export async function revokePushToken(): Promise<boolean> {
  const token = lastSyncedToken;
  lastSyncedToken = null;
  if (!token) return true;
  if (config.useMockApi) return true;

  try {
    await request<void>(`/v1/account/push-tokens/${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/** Test seam: the token this device believes the server has. */
export function syncedPushToken(): string | null {
  return lastSyncedToken;
}

/**
 * Where a notification should take the customer when tapped.
 *
 * The server sends `data.href`; anything else falls back to a sensible screen
 * for its category so a malformed payload still lands somewhere useful rather
 * than dumping the customer on Home with no context.
 */
export function routeForNotification(data: Record<string, unknown> | undefined): string {
  if (!data) return '/(tabs)/home';

  /**
   * Only a path of ours, and `startsWith('/')` is not enough to say so.
   *
   * "//evil.example/phish" starts with a slash and is a protocol-relative URL:
   * on the web build it navigates off-site, which is the exact thing this
   * guard exists to prevent — the test beside it names `https://evil.example`
   * as the threat and this is the same threat with two characters removed.
   * A backslash is rejected for the same reason, since some parsers fold it
   * into a slash.
   */
  const href = data.href;
  if (
    typeof href === 'string' &&
    href.startsWith('/') &&
    !href.startsWith('//') &&
    !href.startsWith('/\\')
  ) {
    return href;
  }

  /**
   * Encoded, the way `apiClient` already encodes the same id on its way into a
   * URL. Unencoded, an id of "../account/payment-methods" is a route of the
   * sender's choosing rather than an order.
   */
  const orderId = data.orderId;
  if (typeof orderId === 'string' && orderId.length > 0) {
    return `/order/${encodeURIComponent(orderId)}`;
  }

  switch (data.category) {
    case 'order':
      return '/(tabs)/orders';
    case 'promotion':
      return '/offers';
    case 'reward':
      return '/(tabs)/rewards';
    default:
      return '/account/notifications';
  }
}

/** Local notification used to preview the ordering flow without a backend. */
export async function scheduleLocalOrderUpdate(
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  secondsFromNow = 5,
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, secondsFromNow),
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}
