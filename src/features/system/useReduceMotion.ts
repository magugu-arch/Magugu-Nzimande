import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the customer has asked their device to reduce motion.
 *
 * Nothing in the app consulted this. Reduce Motion is switched on for
 * vestibular disorders and motion sickness — sliding a screen in from the edge
 * or animating a bar into place can make someone genuinely unwell — and the
 * app did both regardless of the setting.
 *
 * The initial read is asynchronous, so this starts at false and corrects
 * itself. Starting at true would mean every launch flashed through a
 * motionless first frame before animation was allowed back.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });

    // The setting can be changed while the app is open — iOS has it in Control
    // Centre — so a one-off read is not enough.
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
