import { Alert, Linking, Platform } from 'react-native';

/**
 * Handing off to another app — the dialler, mail, maps, WhatsApp.
 *
 * Every one of these calls used to be written inline as
 * `void Linking.openURL(...)`. Two things were wrong with that. The `void`
 * discards a promise that genuinely rejects — a tablet with no dialler, a
 * phone with no mail account, an Android build whose manifest does not declare
 * the intent — so the tap did nothing at all and nobody was told why. And the
 * URLs were being built by string interpolation at the call site, which is how
 * the order screen ended up dialling `tel:bb.q Chicken Rosebank`.
 */

/**
 * A dialler-safe `tel:` URL.
 *
 * South African numbers are written with spaces (`011 883 0100`) and sometimes
 * in international form (`+27 11 883 0100`). `tel:` wants neither: digits, and
 * a leading `+` if the number is international.
 */
export function telUrl(phone: string): string {
  const trimmed = phone.trim();
  const international = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return `tel:${international ? '+' : ''}${digits}`;
}

/** True when there are enough digits to be worth offering as a call. */
export function isDiallable(phone: string | undefined | null): phone is string {
  return typeof phone === 'string' && phone.replace(/\D/g, '').length >= 7;
}

export interface DirectionsTarget {
  latitude: number;
  longitude: number;
  /** What the pin should be called once the maps app opens. */
  label: string;
}

/**
 * Driving directions in whichever maps app the platform prefers.
 *
 * iOS goes to Apple Maps over `https://maps.apple.com`, not the `maps://`
 * scheme: the https form still opens the app when it is installed and falls
 * back to the web when it has been deleted, which the scheme cannot do.
 * Android uses `geo:` so the customer keeps their choice of maps app rather
 * than being forced into Google Maps navigation.
 */
export function directionsUrl({ latitude, longitude, label }: DirectionsTarget): string {
  const point = `${latitude},${longitude}`;
  const name = encodeURIComponent(label);

  if (Platform.OS === 'ios') {
    return `https://maps.apple.com/?daddr=${point}&q=${name}&dirflg=d`;
  }
  if (Platform.OS === 'android') {
    return `geo:${point}?q=${point}(${name})`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${point}`;
}

export interface OpenExternalOptions {
  /** Shown if the handoff fails. Say what the customer can do instead. */
  failureTitle?: string;
  failureMessage?: string;
}

/**
 * Open a URL in another app, and say something when that is not possible.
 *
 * Deliberately does not gate on `canOpenURL`. On Android 11 and up that
 * answers false for any scheme the manifest has not declared in `<queries>`,
 * which produces confident false negatives — the dialler is right there and
 * the app refuses to use it. Attempting the open and catching the rejection is
 * both simpler and more accurate.
 *
 * @returns whether the handoff succeeded, so callers can branch if they need to.
 */
export async function openExternal(
  url: string,
  { failureTitle = 'Could not open that', failureMessage }: OpenExternalOptions = {},
): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(
      failureTitle,
      failureMessage ?? 'This device does not have an app that can handle it.',
    );
    return false;
  }
}

/** Call a number, telling the customer the number if the dialler will not open. */
export function callNumber(phone: string): Promise<boolean> {
  return openExternal(telUrl(phone), {
    failureTitle: 'Could not start the call',
    failureMessage: `Dial ${phone.trim()} to reach them.`,
  });
}

/** Open this app's page in the OS settings, where permissions are re-granted. */
export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    Alert.alert(
      'Could not open settings',
      'Open Settings yourself, find bb.q Chicken, and turn notifications back on.',
    );
    return false;
  }
}

/** Navigate to a place, naming it if no maps app answers. */
export function openDirections(target: DirectionsTarget): Promise<boolean> {
  return openExternal(directionsUrl(target), {
    failureTitle: 'Could not open directions',
    failureMessage: `No maps app answered. ${target.label} is the destination.`,
  });
}
