import { Dimensions, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Badge,
  Card,
  ErrorState,
  ListRow,
  LoadingState,
  ProgressBar,
  Section,
  Text,
} from '@/components/ui';
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { PromotionBanner } from '@/features/home/components/PromotionBanner';
import { RewardCard } from '@/features/rewards/components/RewardCard';
import {
  useLoyaltyAccount,
  usePromotions,
  useRewards,
  useTiers,
  useVouchers,
} from '@/features/rewards/hooks';
import { colors, radius, spacing, CART_BAR_HEIGHT, TAB_BAR_HEIGHT } from '@/theme';
import { formatRelativeDay } from '@/utils/datetime';
import { groupDigits } from '@/utils/money';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REWARD_CARD_WIDTH = Math.min(210, SCREEN_WIDTH * 0.56);

/**
 * Rewards Home (brief §11): points balance, membership tier, available rewards,
 * progress to next reward, offers, expiry and history.
 */
export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loyalty = useLoyaltyAccount();
  const rewards = useRewards();
  const tiers = useTiers();
  const vouchers = useVouchers();
  const promotions = usePromotions();

  if (loyalty.isLoading || rewards.isLoading) {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <LoadingState message="Counting your points…" />
      </View>
    );
  }

  if (loyalty.isError || !loyalty.data) {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ErrorState onRetry={() => void loyalty.refetch()} />
      </View>
    );
  }

  const account = loyalty.data;
  const availableRewards = (rewards.data ?? []).filter((reward) => reward.redeemable);
  const lockedRewards = (rewards.data ?? []).filter((reward) => !reward.redeemable);
  const activeVouchers = (vouchers.data ?? []).filter(
    (voucher) => !voucher.used && !voucher.expired,
  );
  const currentTier = tiers.data?.find((tier) => tier.tier === account.tier);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_BAR_HEIGHT + CART_BAR_HEIGHT },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loyalty.isRefetching}
            onRefresh={() => void loyalty.refetch()}
            tintColor={colors.onPrimary}
          />
        }
        testID="rewards-screen"
      >
        {/* Points hero */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <Text variant="overline" color={colors.textOnDarkMuted}>
            bb.q Rewards · {account.memberId}
          </Text>

          <View style={styles.balanceRow}>
            <Text variant="display" color={colors.textOnDark}>
              {groupDigits(account.pointsBalance)}
            </Text>
            <Text variant="h3" color={colors.textOnDarkMuted} style={styles.pointsLabel}>
              points
            </Text>
          </View>

          <View style={styles.tierRow}>
            <Badge label={`${account.tierName} member`} tone="onImage" icon="star" />
            <Text variant="caption" color={colors.textOnDarkMuted}>
              {groupDigits(account.lifetimePoints)} lifetime
            </Text>
          </View>

          <View style={styles.progressBlock}>
            <ProgressBar
              progress={account.tierProgress}
              trackColor="rgba(255,255,255,0.22)"
              fillColor={colors.onPrimary}
              accessibilityLabel={`${Math.round(account.tierProgress * 100)} percent to next tier`}
            />
            <Text variant="caption" color={colors.textOnDark}>
              {account.nextTier
                ? `${groupDigits(account.pointsToNextTier)} points to ${
                    account.nextTier.charAt(0).toUpperCase() + account.nextTier.slice(1)
                  }`
                : "You're at our top tier"}
            </Text>
          </View>
        </View>

        <View style={styles.sheet}>
          {/* Tier perks */}
          {currentTier ? (
            <Card style={styles.card}>
              <View style={styles.perksHeader}>
                <Text variant="h3">Your {currentTier.name} perks</Text>
                <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
              </View>
              {currentTier.perks.map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
                  <Text variant="caption" color={colors.textSecondary} style={styles.perkText}>
                    {perk}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Available rewards */}
          <Section
            title="Ready to redeem"
            subtitle={`${availableRewards.length} reward${availableRewards.length === 1 ? '' : 's'} you can claim now`}
            bleed
            style={styles.section}
          >
            {availableRewards.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
              >
                {availableRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    pointsBalance={account.pointsBalance}
                    width={REWARD_CARD_WIDTH}
                    onPress={() => router.push(`/rewards/${reward.id}`)}
                    testID={`reward-${reward.id}`}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyBlock}>
                <Text variant="caption" color={colors.textSecondary}>
                  Keep ordering — your first reward unlocks at 300 points.
                </Text>
              </View>
            )}
          </Section>

          {/* Voucher wallet */}
          <Card
            onPress={() => router.push('/rewards/vouchers')}
            style={styles.card}
            accessibilityLabel="Voucher wallet"
          >
            <View style={styles.walletRow}>
              <View style={styles.walletIcon}>
                <Ionicons name="ticket-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.walletBody}>
                <Text variant="bodyMedium">Voucher wallet</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {activeVouchers.length > 0
                    ? `${activeVouchers.length} voucher${activeVouchers.length === 1 ? '' : 's'} ready to use`
                    : 'No active vouchers right now'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
            </View>
          </Card>

          {/* Working toward */}
          {lockedRewards.length > 0 ? (
            <Section
              title="Working toward"
              subtitle="Keep going — these unlock as you earn"
              bleed
              style={styles.section}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
              >
                {lockedRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    pointsBalance={account.pointsBalance}
                    width={REWARD_CARD_WIDTH}
                    onPress={() => router.push(`/rewards/${reward.id}`)}
                  />
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {/* Offers */}
          {(promotions.data?.length ?? 0) > 0 ? (
            <Section
              title="Members-only offers"
              actionLabel="All offers"
              onActionPress={() => router.push('/offers')}
              bleed
              style={styles.section}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
              >
                {(promotions.data ?? []).map((promotion) => (
                  <PromotionBanner
                    key={promotion.id}
                    promotion={promotion}
                    size="compact"
                    width={REWARD_CARD_WIDTH + 30}
                    onPress={() => router.push(`/offers/${promotion.id}`)}
                  />
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {/* Points history */}
          <Section title="Points history" subtitle="Everything you have earned and spent">
            <Card padded={false} style={styles.historyCard}>
              {account.history.map((entry, index) => (
                <View key={entry.id}>
                  {index > 0 ? <View style={styles.separator} /> : null}
                  <ListRow
                    title={entry.description}
                    subtitle={formatRelativeDay(entry.occurredAt)}
                    icon={entry.points >= 0 ? 'add-circle-outline' : 'remove-circle-outline'}
                    showChevron={false}
                    right={
                      <Text
                        variant="bodyMedium"
                        color={entry.points >= 0 ? colors.status.success : colors.textSecondary}
                      >
                        {entry.points >= 0 ? '+' : ''}
                        {groupDigits(entry.points)}
                      </Text>
                    }
                    style={styles.historyRow}
                  />
                </View>
              ))}
            </Card>

            <Text variant="caption" color={colors.textMuted} style={styles.expiryNote}>
              Points expire 12 months after they are earned.
            </Text>
          </Section>
        </View>
      </ScrollView>

      <StickyCartBar offsetBottom={TAB_BAR_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  stateRoot: { flex: 1, backgroundColor: colors.background },
  content: { backgroundColor: colors.primary },
  hero: {
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.primary,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  pointsLabel: { marginBottom: spacing.xs },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressBlock: { gap: spacing.sm, marginTop: spacing.md },
  sheet: {
    gap: spacing.xxl,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.background,
  },
  card: { gap: spacing.sm },
  section: { marginHorizontal: -spacing.lg },
  carousel: { gap: spacing.md, paddingHorizontal: spacing.gutter },
  perksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  perkText: { flex: 1 },
  emptyBlock: { paddingHorizontal: spacing.gutter },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  walletIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  walletBody: { flex: 1, gap: spacing.xxs },
  historyCard: { paddingHorizontal: spacing.lg },
  historyRow: { paddingVertical: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  expiryNote: { paddingTop: spacing.sm },
});
