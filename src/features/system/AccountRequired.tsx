import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

/**
 * What a screen shows somebody who has not signed in.
 *
 * The app offers "Continue as guest" and then took them to screens built
 * entirely out of account data. Only Profile checked. Driven as a guest
 * against the mock, which is the build a demo runs on:
 *
 *     /rewards                  BBQ-SA-004182 | 1 840 points | Silver member
 *     /checkout/address         Home | 14 Acacia Road, Unit 3 | Melrose Arch…
 *     /account/payment-methods  Visa ending 4821 | Mastercard ending 7702
 *
 * A stranger's home address and card last-fours, shown to somebody with no
 * account at all. Against a real API those calls 401 instead, so the data
 * itself is a mock artefact — but the missing gate is not: a guest would meet
 * an error screen where they should meet an invitation, and the request would
 * be made at all.
 *
 * One component rather than six copies of the same block, because the copy
 * and the route have to agree across all of them — Profile had it right and
 * the others had nothing, which is what six copies looks like before anybody
 * writes the sixth.
 */
export interface AccountRequiredProps {
  /** The screen's own title, so the header does not change under them. */
  title: string;
  /** What they would see here once signed in, in their own terms. */
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}

/** Whether this screen should be showing account data at all. */
export function useIsSignedOut(): boolean {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isGuest = useAuthStore((state) => state.isGuest);
  return !isAuthenticated || isGuest;
}

export function AccountRequired({
  title,
  message,
  icon = 'person-outline',
  testID,
}: AccountRequiredProps) {
  const router = useRouter();

  return (
    <Screen edges={['top', 'bottom']} testID={testID ?? 'account-required'}>
      <ScreenHeader title={title} />
      <EmptyState
        icon={icon}
        title={`Sign in to see your ${title.toLowerCase()}`}
        message={message}
        actionLabel="Sign in"
        onActionPress={() => router.push('/(auth)/sign-in')}
      />
    </Screen>
  );
}
