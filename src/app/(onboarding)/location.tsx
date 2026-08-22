import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Screen, Text } from '@/components/ui';
import { useDeviceLocation } from '@/features/stores/hooks';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { colors, radius, spacing } from '@/theme';

const BENEFITS = [
  { icon: 'storefront-outline', text: 'Find your nearest bb.q store instantly' },
  { icon: 'time-outline', text: 'Get accurate delivery times, not guesses' },
  { icon: 'bicycle-outline', text: 'See exactly what the delivery fee will be' },
] as const;

/**
 * Location Permission (brief §4).
 *
 * A pre-permission screen: we explain why before triggering the OS prompt, so a
 * customer who taps "Not now" here can still be asked again later — unlike an
 * OS-level denial, which is permanent until they visit Settings.
 */
export default function LocationPermissionScreen() {
  const router = useRouter();
  const { requestLocation } = useDeviceLocation();
  const markAsked = useFulfilmentStore((state) => state.markLocationPermissionAsked);

  const [requesting, setRequesting] = useState(false);

  const continueToApp = useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  const handleAllow = useCallback(async () => {
    setRequesting(true);
    await requestLocation();
    setRequesting(false);
    continueToApp();
  }, [requestLocation, continueToApp]);

  const handleSkip = useCallback(() => {
    markAsked();
    continueToApp();
  }, [markAsked, continueToApp]);

  return (
    <Screen edges={['top', 'bottom']} testID="location-permission-screen">
      <View style={styles.body}>
        <View style={styles.iconWell}>
          <Ionicons name="location" size={38} color={colors.onPrimary} />
        </View>

        <Text variant="h1" align="center">
          Where are we delivering?
        </Text>
        <Text variant="bodyLarge" color={colors.textSecondary} align="center">
          Share your location and we will put your closest store, real delivery times and accurate
          fees front and centre.
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit.text} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={benefit.icon} size={17} color={colors.primary} />
              </View>
              <Text variant="body" color={colors.textSecondary} style={styles.benefitText}>
                {benefit.text}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Use my location"
          onPress={() => void handleAllow()}
          loading={requesting}
          size="lg"
          iconLeft="navigate"
          testID="location-allow"
        />
        <Button label="Not now" onPress={handleSkip} variant="ghost" testID="location-skip" />
        <Text variant="caption" color={colors.textMuted} align="center">
          We only use your location while the app is open, and never share it.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
  },
  benefits: { gap: spacing.md, marginTop: spacing.xl, alignSelf: 'stretch' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  benefitText: { flex: 1 },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
});
