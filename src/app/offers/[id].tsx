import { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { FoodImage } from '@/components/food/FoodImage';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { usePromotion } from '@/features/rewards/hooks';
import { inAppRoute } from '@/utils/linking';
import { colors, radius, spacing } from '@/theme';
import { formatShortDate } from '@/utils/datetime';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Promotional Detail (brief §4). */
export default function OfferDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const promotion = usePromotion(id);

  const [copied, setCopied] = useState(false);

  const handleCopyCode = useCallback(async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, []);

  if (promotion.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Offer" />
        <LoadingState />
      </Screen>
    );
  }

  if (promotion.isError || !promotion.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Offer" />
        <ErrorState
          title="That offer has ended"
          message="It is no longer running. Take a look at what else is on."
          onRetry={() => void promotion.refetch()}
        />
        <Button label="See all offers" onPress={() => router.replace('/offers')} />
      </Screen>
    );
  }

  const data = promotion.data;

  return (
    <Screen scroll edges={['top', 'bottom']} padded={false} testID="offer-detail-screen">
      <View style={styles.headerWrap}>
        <ScreenHeader title="Offer" />
      </View>

      <FoodImage
        assetKey={data.assetKey}
        variant="banner"
        aspectRatio={16 / 9}
        rounded="none"
        withScrim={data.usePromotionalComposition}
        style={styles.hero}
      />

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          {data.promoCode ? (
            <Badge label="Promo code offer" tone="primary" icon="pricetag" />
          ) : null}
          <Text variant="h1">{data.headline}</Text>
          <Text variant="bodyLarge" color={colors.textSecondary}>
            {data.description}
          </Text>
        </View>

        {/* Promo code */}
        {data.promoCode ? (
          <Card style={styles.card}>
            <Text variant="caption" color={colors.textSecondary}>
              Use this code at checkout
            </Text>

            <View style={styles.codeRow}>
              <View style={styles.code}>
                <Text variant="h2">{data.promoCode}</Text>
              </View>
              <Button
                label={copied ? 'Copied' : 'Copy'}
                onPress={() => void handleCopyCode(data.promoCode as string)}
                variant={copied ? 'secondary' : 'tertiary'}
                iconLeft={copied ? 'checkmark' : 'copy-outline'}
                fullWidth={false}
                testID="offer-copy-code"
                preserveCase
              />
            </View>
          </Card>
        ) : null}

        {/* Validity */}
        <Card style={styles.card}>
          <View style={styles.validityRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text variant="caption" color={colors.textSecondary} style={styles.validityText}>
              Valid {formatShortDate(data.validFrom)} to {formatShortDate(data.validUntil)}
            </Text>
          </View>
        </Card>

        {/* Terms */}
        <Card style={styles.card}>
          <Text variant="h3">Terms and conditions</Text>
          {data.terms.map((term) => (
            <View key={term} style={styles.termRow}>
              <Ionicons name="ellipse" size={5} color={colors.textMuted} style={styles.bullet} />
              <Text variant="caption" color={colors.textSecondary} style={styles.termText}>
                {term}
              </Text>
            </View>
          ))}
        </Card>

        <Button
          label={data.ctaLabel}
          // Server data, so not followed on trust. This pushed whatever
          // arrived: a promotion carrying "https://evil.example" navigated
          // off-site on the web build. A broken link opens the menu instead
          // of the void.
          onPress={() => router.push(inAppRoute(data.ctaHref, '/(tabs)/menu') as Href)}
          size="lg"
          testID="offer-cta"
          preserveCase
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.gutter },
  hero: { width: SCREEN_WIDTH },
  body: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.sm },
  card: { gap: spacing.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  code: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  validityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  validityText: { flex: 1 },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: { marginTop: 7 },
  termText: { flex: 1 },
});
