import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { config } from '@/constants/config';
import { inAppRoute } from '@/utils/linking';
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
 * Written to disk as well as held in memory, because the thing that needs it
 * back is sign-out, and sign-out routinely happens in a different session from
 * the sync that produced it.
 *
 * It was memory alone, and that made the unbinding a no-op in exactly the cases
 * it exists for. `revokePushToken` returns early when the token is null, so:
 *
 *   - Push turned off in preferences — `usePushRegistration` returns before
 *     syncing, so nothing repopulates the token on later launches. The handset
 *     stays bound to the account for ever.
 *   - Signing out soon after opening the app, before registration resolves.
 *   - Any launch where the permission prompt or the network failed.
 *
 * In each of those, sign-out reported success and sent no DELETE, so the server
 * kept pushing one person's order updates — reference and all — to a phone
 * somebody else is now holding. That is the whole failure this was written to
 * prevent, and it was reachable by turning off notifications.
 */
const TOKEN_KEY = 'bbq.pushToken';

let lastSyncedToken: string | null = null;

async function remember(token: string | null): Promise<void> {
  lastSyncedToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // A device that will not write is not a reason to fail a sign-in. The
    // in-memory copy still covers the common case.
  }
}

/** What to unbind, from memory or from disk. */
async function boundToken(): Promise<string | null> {
  if (lastSyncedToken) return lastSyncedToken;
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function syncPushToken(token: string): Promise<boolean> {
  if (config.useMockApi) {
    await remember(token);
    return true;
  }

  try {
    await request<void>('/v1/account/push-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS },
    });
    await remember(token);
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
  const token = await boundToken();

  // Forgotten either way. A token we failed to delete is one the next sign-out
  // cannot delete either — the account it was bound to is already gone — so
  // holding on to it would only make a later sign-out try to unbind a stranger.
  await remember(null);

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

/** Test seam: the token this device believes the server has, from disk. */
export function syncedPushToken(): Promise<string | null> {
  return boundToken();
}

/** Test seam: forget the in-memory copy, the way a fresh launch does. */
export function forgetPushTokenInMemory(): void {
  lastSyncedToken = null;
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

  // Only a path of ours. `startsWith('/')` is not enough to say so — see
  // `inAppRoute`, which both this and the offers screen now go through.
  const href = data.href;
  if (typeof href === 'string' && inAppRoute(href, '') !== '') return inAppRoute(href, '');

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
