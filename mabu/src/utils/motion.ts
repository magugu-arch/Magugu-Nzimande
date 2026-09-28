import { Platform } from 'react-native';

/**
 * An entering animation, on the phone only.
 *
 * The website renders each page to HTML before anyone opens it, and an
 * entering animation starts from `visibility: hidden`. A guest who has asked
 * their browser for less movement never runs the animation, so on the web that
 * content would stay hidden. Native builds keep the animation; the web shows
 * the content at once.
 */
export function enter<T>(animation: T): T | undefined {
  return Platform.OS === 'web' ? undefined : animation;
}
