import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Reward } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import { Badge, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export interface RewardCardProps {
  reward: Reward;
  pointsBalance: number;
  onPress: () => void;
  width?: number;
  testID?: string;
}

const CATEGORY_ICONS: Record<Reward['category'], keyof typeof Ionicons.glyphMap> = {
  food: 'fast-food-outline',
  discount: 'pricetag-outline',
  delivery: 'bicycle-outline',
  birthday: 'gift-outline',
};

export const RewardCard = memo(function RewardCard({
  reward,
  pointsBalance,
  onPress,
  width,
  testID,
}: RewardCardProps) {
  const shortfall = Math.max(0, reward.pointsCost - pointsBalance);
  const locked = !reward.redeemable;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${reward.name}, ${reward.pointsCost} points. ${
        locked ? `${shortfall} more points needed` : 'Available to redeem'
      }`}
      style={({ pressed }) => [
        styles.card,
        width !== undefined ? { width } : styles.flexible,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.imageWrap}>
        {reward.assetKey ? (
          <FoodImage
            assetKey={reward.assetKey}
            variant="card"
            aspectRatio={3 / 2}
            rounded="none"
            style={locked ? styles.dimmed : undefined}
          />
        ) : (
          <View style={styles.iconTile}>
            <Ionicons name={CATEGORY_ICONS[reward.category]} size={30} color={colors.primary} />
          </View>
        )}

        {locked ? (
          <View style={styles.lock}>
            <Ionicons name="lock-closed" size={13} color={colors.textOnDark} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text variant="h3" numberOfLines={2}>
          {reward.name}
        </Text>
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
          {reward.description}
        </Text>

        <View style={styles.footer}>
          {reward.category === 'birthday' ? (
            <Badge label="Birthday gift" tone="neutral" icon="gift" />
          ) : (
            <Badge
              label={`${reward.pointsCost.toLocaleString('en-ZA')} pts`}
              tone={locked ? 'neutral' : 'primary'}
              icon="star"
            />
          )}

          {locked && shortfall > 0 ? (
            <Text variant="micro" color={colors.textMuted}>
              {shortfall.toLocaleString('en-ZA')} MORE
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  flexible: { flex: 1 },
  imageWrap: { position: 'relative' },
  dimmed: { opacity: 0.5 },
  iconTile: {
    aspectRatio: 3 / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  lock: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,30,30,0.78)',
  },
  body: { padding: spacing.md, gap: spacing.xxs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.9 },
});
