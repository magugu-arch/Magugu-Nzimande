import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Card,
  Header,
  InlineNotice,
  LoadingBlock,
  Photo,
  PremiumButton,
  Screen,
  Text,
} from '@/components/ui';
import { formatPoints } from '@/domain/shared/format';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { errorMessage } from '@/services/api';
import { ACCOUNT_QUERIES, useRpc, useRpcMutation } from '@/services/queries';
import { radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

/** §35: reward details and terms → redeem → confirm → code. */
export default function RewardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallet = useRpc('rewards.wallet');
  const programme = useRpc('rewards.programme');
  const [confirming, setConfirming] = useState(false);
  // One key per visit to this screen: a double tap or retry redeems once (§34).
  const [key] = useState(newIdempotencyKey);
  const redeem = useRpcMutation('rewards.redeem', [...ACCOUNT_QUERIES]);

  const reward =
    wallet.data?.catalogue?.find((r) => r.id === id) ??
    programme.data?.catalogue.find((r) => r.id === id);
  if (!reward)
    return (
      <Screen header={<Header title="Reward" />}>
        <LoadingBlock />
      </Screen>
    );

  const account = wallet.data?.account;
  const eligible = !!wallet.data?.available?.some((r) => r.id === id);
  const balance = account?.balancePoints ?? 0;
  const short = reward.pointsCost - balance;
  const tierNames = programme.data?.tiers
    .filter((t) => reward.tierIds?.includes(t.id))
    .map((t) => t.name);

  return (
    <Screen
      meta={{ title: 'Reward', noindex: true }}
      header={<Header title="Reward" />}
      footer={
        !account ? (
          <PremiumButton label="Join MÁBU Rewards" onPress={() => router.replace('/rewards')} />
        ) : !eligible ? undefined : confirming ? (
          <>
            <PremiumButton
              label={`Confirm · ${formatPoints(reward.pointsCost)} points`}
              loading={redeem.isPending}
              onPress={() =>
                redeem.mutate(
                  { rewardId: reward.id, idempotencyKey: key },
                  {
                    onSuccess: (r) => {
                      haptic.success();
                      router.replace(`/rewards/redemption/${r.redemption.id}`);
                    },
                    onError: () => haptic.warn(),
                  },
                )
              }
              testID="reward-confirm"
            />
            <PremiumButton label="Not now" variant="ghost" onPress={() => setConfirming(false)} />
          </>
        ) : (
          <PremiumButton
            label="Redeem"
            disabled={short > 0}
            onPress={() => setConfirming(true)}
            testID="reward-redeem"
          />
        )
      }
    >
      <Photo
        photo={reward.photo}
        label={reward.name}
        style={{ height: 220, borderRadius: radius.md, marginTop: spacing.md }}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Text variant="h1" accessibilityRole="header">
          {reward.name}
        </Text>
        <Text variant="h3" color="accent">
          {formatPoints(reward.pointsCost)} points
        </Text>
        <Text variant="body" color="textMuted">
          {reward.description}
        </Text>
      </View>
      <Card style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Text variant="eyebrow" color="textMuted">
          Terms
        </Text>
        <Text variant="bodySmall">{reward.terms}</Text>
        <Text variant="bodySmall" color="textMuted">
          The code is valid for {reward.redemptionValidDays} days and can be used once.
        </Text>
      </Card>
      {account && !eligible ? (
        <InlineNotice tone="info" style={{ marginTop: spacing.lg }}>
          {`Reserved for ${tierNames?.join(' and ') ?? 'a higher tier'} members.`}
        </InlineNotice>
      ) : account && short > 0 ? (
        <InlineNotice tone="info" style={{ marginTop: spacing.lg }}>
          {`You need ${formatPoints(short)} more points.`}
        </InlineNotice>
      ) : null}
      {confirming ? (
        <Text variant="body" style={{ marginTop: spacing.lg }}>
          {formatPoints(reward.pointsCost)} points will be deducted, leaving{' '}
          {formatPoints(balance - reward.pointsCost)}.
        </Text>
      ) : null}
      {redeem.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.lg }}>
          {errorMessage(redeem.error)}
        </InlineNotice>
      ) : null}
    </Screen>
  );
}
