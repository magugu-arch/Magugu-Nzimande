import { AccessibilityInfo } from 'react-native';

/**
 * Say something out loud to a screen reader.
 *
 * For changes the customer did not cause. Tapping a button is its own
 * feedback; an order moving from Preparing to Ready while the screen sits
 * open, or a saved basket being repriced the moment the menu loads, is not —
 * a sighted customer sees it happen and everyone else is told nothing.
 *
 * `announceForAccessibility` is a no-op when no screen reader is running, so
 * this costs nothing in the common case and needs no guard of its own.
 */
export function announce(message: string): void {
  const trimmed = message.trim();
  if (trimmed.length === 0) return;
  AccessibilityInfo.announceForAccessibility(trimmed);
}
