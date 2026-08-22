import type { Href } from 'expo-router';
import { useFulfilmentStore } from '@/store/fulfilmentStore';

/**
 * Where a customer lands once they are through the door.
 *
 * First time through we ask for location — it makes the store picker and every
 * delivery estimate accurate. Once asked (granted or declined), we never ask
 * again on sign-in and go straight to Home.
 *
 * Shared by sign-in, guest entry and OTP verification so all three agree.
 */
export function postAuthRoute(): Href {
  const { locationPermissionAsked, coordinates } = useFulfilmentStore.getState();
  const alreadyResolved = locationPermissionAsked || coordinates !== null;
  return alreadyResolved ? '/(tabs)/home' : '/(onboarding)/location';
}
