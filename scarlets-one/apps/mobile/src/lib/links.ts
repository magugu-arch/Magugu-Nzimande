import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform, Share } from 'react-native';

/**
 * Open an official destination. On a phone it opens in an in-app browser so
 * the supporter lands back where they were; on the web it opens a new tab.
 */
export async function openOfficial(url: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url).catch(() => undefined);
  }
}

/** The system share sheet. Returns false if sharing is unavailable or dismissed. */
export async function shareText(message: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator === 'undefined' ? undefined : navigator;
      if (nav?.share) {
        await nav.share({ text: message });
        return true;
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(message);
        return true;
      }
      return false;
    }
    const result = await Share.share({ message });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
