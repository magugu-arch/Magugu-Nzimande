import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useReducedMotion as useSystemReducedMotion } from 'react-native-reanimated';
import { usePrefs } from '@/state/prefs';

export { clamp, nearest, project, rubberband, spring, springs } from '@scarlets/ui';

/**
 * True when motion should be replaced by a gentle fade: the system setting,
 * or the in-app switch. Reduced motion never means no feedback.
 */
export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion();
  const inApp = usePrefs((s) => s.reduceMotion);
  return system || inApp;
}

function mediaQuery(query: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

/**
 * True when translucent chrome should become solid: the reader asked for
 * reduced transparency or more contrast.
 */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(
    () =>
      mediaQuery('(prefers-reduced-transparency: reduce)') ||
      mediaQuery('(prefers-contrast: more)'),
  );
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => {
        if (live) setReduce(Boolean(value));
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
