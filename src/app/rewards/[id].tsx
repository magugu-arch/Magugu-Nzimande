import { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FoodImage } from '@/components/food/FoodImage';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  ProgressBar,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { useLoyaltyAccount, useRedeemReward, useReward } from '@/features/rewards/hooks';
import { useNow } from '@/features/system/useNow';
import { rewardExpired } from '@/services/rewardsService';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing } from '@/theme';
import { formatShortDate } from '@/utils/datetime';
import { formatPrice, groupDigits } from '@/utils/money';
import { track } from '@/ux/analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Reward Details + Rewards Redemption (brief §4). */
export default function RewardDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const reward = useReward(id);
  const loyalty = useLoyaltyAccount();
  const redeemReward = useRedeemReward();
  const applyReward = useCartStore((state) => state.applyReward);
  const cartLines = useCartStore((state) => state.lines);

  const now = useNow();
  const user = useAuthStore((state) => state.user);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = useCallback(async () => {
    if (!reward.data) return;
    setError(null);

    try {
      const result = await redeemReward.mutateAsync(reward.data.id);
      applyReward({
        rewardId: result.reward.id,
        name: result.reward.name,
        discount: result.discount,
        pointsCost: result.reward.pointsCost,
        // Carried so the bill knows what kind of reward this is: a delivery
        // one covers the fee rather than discounting the food.
        category: result.reward.category,
      });

      // §15 `reward_redeem`, after the redemption succeeded rather than on the
      // tap — a failed redemption that still reported here would inflate the
      // programme's take-up with attempts nobody actually got.
      track('reward_redeem', {
        rewardId: result.reward.id,
        pointsCost: result.reward.pointsCost,
        value: result.discount,
      });

      // Straight to the cart, where the discount is now visible on the totals.
      router.replace(cartLines.length > 0 ? '/cart' : '/(tabs)/menu');
    } catch (redeemError) {
      setError(
        redeemError instanceof Error ? redeemError.message : 'We could not redeem that reward.',
      );
    }
  }, [reward.data, redeemReward, applyReward, router, cartLines.length]);

  if (reward.isLoading || loyalty.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Reward" />
        <LoadingState />
      </Screen>
    );
  }

  if (reward.isError || !reward.data || !loyalty.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Reward" />
        <ErrorState
          title="We can't find that reward"
          message="It may have expired. Have a look at what else is available."
          onRetry={() => void reward.refetch()}
        />
      </Screen>
    );
  }

  const data = reward.data;
  // Derived here rather than trusted off the record: this screen can sit open
  // across the moment a reward lapses.
  const expired = rewardExpired(data, now);
  const balance = loyalty.data.pointsBalance;
  const shortfall = Math.max(0, data.pointsCost - balance);
  const progress = data.pointsCost > 0 ? Math.min(1, balance / data.pointsCost) : 1;
  /**
   * Why a locked birthday reward is locked, which is never the points.
   *
   * The box costs nothing, so "Not enough points yet" was not merely the
   * wrong reason — it contradicted the zero printed a few lines above it. The
   * two walls a customer can actually hit are the month and a profile with no
   * date of birth in it, and the second is one they can do something about.
   */
  const birthdayLocked = data.category === 'birthday' && !data.redeemable && !expired;
  const noDateOnFile = birthdayLocked && !user?.dateOfBirth;

  return (
    <Screen scroll edges={['top', 'bottom']} padded={false} testID="reward-detail-screen">
      <View style={styles.headerWrap}>
        <ScreenHeader title="Reward" />
      </View>

      {data.assetKey ? (
        <FoodImage
          assetKey={data.assetKey}
          variant="banner"
          aspectRatio={16 / 9}
          rounded="none"
          style={styles.hero}
        />
      ) : (
        <View style={styles.iconHero}>
          <Ionicons name="gift" size={48} color={colors.primary} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          {data.category === 'birthday' ? (
            <Badge label="Birthday gift" tone="primary" icon="gift" />
          ) : (
            <Badge
              label={`${groupDigits(data.pointsCost)} points`}
              tone={data.redeemable ? 'primary' : 'neutral'}
              icon="star"
            />
          )}

          <Text variant="h1">{data.name}</Text>
          <Text variant="bodyLarge" color={colors.textSecondary}>
            {data.description}
          </Text>
        </View>

        {/* Points progress */}
        <Card style={styles.card}>
          <View style={styles.balanceRow}>
            <Text variant="caption" color={colors.textSecondary}>
              Your balance
            </Text>
            <Text variant="bodyMedium">
              {groupDigits(balance)} / {groupDigits(data.pointsCost)} pts
            </Text>
          </View>

          <ProgressBar
            progress={progress}
            accessibilityLabel={`${Math.round(progress * 100)} percent of the points needed`}
          />

          <Text
            variant="caption"
            color={data.redeemable && !expired ? colors.status.success : colors.textSecondary}
          >
            {/*
              Expiry answers first, because it is the only wall points cannot
              get past. The Heritage reward is seeded expired with a balance
              well over its cost, and this card was quoting the shortfall of a
              reward nobody can have: "0 points to go — roughly R 0.00 of
              spending", directly above a button reading "This reward has
              expired". Two claims on one card, one of them an invitation.
            */}
            {expired
              ? 'This one has closed. Have a look at what else is on the ladder.'
              : data.category === 'birthday'
                ? noDateOnFile
                  ? 'Add your date of birth to your profile and this unlocks in your birthday month.'
                  : data.redeemable
                    ? 'It is your birthday month. This is yours whenever you want it.'
                    : 'Unlocks automatically during your birthday month.'
                : data.redeemable
                  ? 'You have enough points. Redeem it whenever you like.'
                  : `${groupDigits(shortfall)} points to go — roughly ${formatPrice(shortfall)} of spending.`}
          </Text>
        </Card>

        {/* Terms */}
        <Card style={styles.card}>
          <Text variant="h3">The fine print</Text>
          {data.termsAndConditions.map((term) => (
            <View key={term} style={styles.termRow}>
              <Ionicons name="ellipse" size={5} color={colors.textMuted} style={styles.bullet} />
              <Text variant="caption" color={colors.textSecondary} style={styles.termText}>
                {term}
              </Text>
            </View>
          ))}
          {data.expiresAt ? (
            <Text variant="caption" color={colors.status.warning}>
              Expires {formatShortDate(data.expiresAt)}
            </Text>
          ) : null}
        </Card>

        {error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text variant="caption" color={colors.status.error}>
              {error}
            </Text>
          </View>
        ) : null}

        <Button
          label={
            // "Not enough points" is the wrong reason for an expired reward,
            // and points are not something the customer can do anything about
            // here. Say which wall they have hit.
            expired
              ? 'This reward has expired'
              : data.redeemable
                ? 'Redeem this reward'
                : noDateOnFile
                  ? 'Add your date of birth'
                  : birthdayLocked
                    ? 'Unlocks in your birthday month'
                    : 'Not enough points yet'
          }
          onPress={() => void handleRedeem()}
          disabled={!data.redeemable}
          loading={redeemReward.isPending}
          size="lg"
          testID="reward-redeem"
          preserveCase
        />

        <Button
          label="Browse the menu"
          onPress={() => router.push('/(tabs)/menu')}
          variant="text"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: spacing.gutter },
  hero: { width: SCREEN_WIDTH },
  iconHero: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  body: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  titleBlock: { gap: spacing.sm },
  card: { gap: spacing.sm },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: { marginTop: 7 },
  termText: { flex: 1 },
  errorBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.status.errorSoft,
  },
});
