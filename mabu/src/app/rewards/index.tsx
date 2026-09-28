import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { ExperienceBadge } from '@/components/mabu/Menu';
import {
  Card,
  ErrorState,
  Header,
  InlineNotice,
  LoadingBlock,
  Photo,
  PremiumButton,
  Screen,
  SectionTitle,
  Segmented,
  Text,
} from '@/components/ui';
import type { Reward } from '@/domain/rewards/types';
import { formatDateShort, formatDateWithYear, formatPoints } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { ACCOUNT_QUERIES, useRpc, useRpcMutation } from '@/services/queries';
import { colors, radius, spacing } from '@/theme';
import { track } from '@/utils/analytics';

const TX_LABEL: Record<string, string> = {
  earn: 'Earned',
  redeem: 'Redeemed',
  adjust: 'Adjustment',
  expire: 'Expired',
  reverse: 'Reversal',
};

/** §35 Profile › MÁBU Rewards. */
export default function RewardsWallet() {
  const wallet = useRpc('rewards.wallet');
  const programme = useRpc('rewards.programme');
  const optIn = useRpcMutation('rewards.optIn', [...ACCOUNT_QUERIES]);
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards');

  useEffect(() => {
    if (wallet.data?.account) track('reward_viewed');
    if (wallet.data?.expiring?.length) track('reward_expiry_viewed');
  }, [wallet.data]);

  if (wallet.isPending)
    return (
      <Screen header={<Header title="MÁBU Rewards" />}>
        <LoadingBlock />
      </Screen>
    );
  if (wallet.isError)
    return (
      <Screen header={<Header title="MÁBU Rewards" />}>
        <ErrorState message={errorMessage(wallet.error)} onRetry={() => void wallet.refetch()} />
      </Screen>
    );

  const w = wallet.data;
  if (!w.account) {
    return (
      <Screen header={<Header title="MÁBU Rewards" />}>
        <Photo photo="chandeliers" label="" style={styles.joinPhoto} scrim="bottom" />
        <Text variant="h1" style={{ marginTop: spacing.xl }} accessibilityRole="header">
          Privileges, not discounts.
        </Text>
        <Text variant="body" color="textMuted" style={{ marginTop: spacing.sm }}>
          Earn with every completed visit, event and gift. Rise through Member, Signature and Privé
          for priority booking, pairing upgrades and invitation-only evenings.
        </Text>
        {programme.data ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            {programme.data.rules.map((r) => (
              <View key={r.id} style={styles.rule}>
                <Text variant="body" style={{ flex: 1 }}>
                  {r.name}
                </Text>
                <Text variant="price" color="accent">
                  {r.pointsPer100Rand ? `${r.pointsPer100Rand} pts / R100` : `${r.points} pts`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {optIn.isError ? (
          <InlineNotice tone="danger" style={{ marginTop: spacing.lg }}>
            {errorMessage(optIn.error)}
          </InlineNotice>
        ) : null}
        <PremiumButton
          label="Join MÁBU Rewards"
          style={{ marginTop: spacing.xl }}
          loading={optIn.isPending}
          onPress={() => optIn.mutate(undefined)}
          testID="rewards-join"
        />
        <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.md }}>
          Points are earned once a visit is completed; cancelled and missed bookings do not earn.
          Unused points expire {programme.data?.settings.pointsExpiryMonths ?? 12} months after they
          are earned.
        </Text>
      </Screen>
    );
  }

  const { account, progress, available, catalogue, expiring, redemptions, history } = w;
  const availableIds = new Set(available?.map((r) => r.id));
  const issued = redemptions?.filter((r) => r.status === 'issued') ?? [];

  return (
    <Screen header={<Header title="MÁBU Rewards" />}>
      <View style={styles.card}>
        <Photo photo="texture-timber" label="" style={StyleSheet.absoluteFill} scrim="full" />
        <View style={{ padding: spacing.xl, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <BrandIcon name="rewards" size={22} />
            <Text variant="eyebrow" color="accent">
              MÁBU Rewards · {progress?.current.name}
            </Text>
          </View>
          <Text variant="hero">{formatPoints(account.balancePoints)}</Text>
          <Text variant="eyebrow" color="textMuted">
            points to spend · {formatPoints(account.lifetimePoints)} lifetime
          </Text>
          {progress?.next ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
              <View
                style={styles.track}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100) }}
              >
                <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%` }]} />
              </View>
              <Text variant="caption" color="textMuted">
                {formatPoints(progress.pointsToNext)} lifetime points to {progress.next.name}
              </Text>
            </View>
          ) : (
            <Text variant="caption" color="accent">
              You hold our highest tier. Thank you.
            </Text>
          )}
        </View>
      </View>

      {expiring?.length ? (
        <InlineNotice tone="warning" style={{ marginTop: spacing.lg }}>
          {`${formatPoints(expiring.reduce((s, l) => s + l.points, 0))} points expire on ${formatDateWithYear(expiring[0]!.expiresAt)}.`}
        </InlineNotice>
      ) : null}

      {issued.length ? (
        <>
          <SectionTitle eyebrow="Ready to enjoy" title="Your rewards" />
          {issued.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/rewards/redemption/${r.id}`)}
              accessibilityRole="button"
              style={styles.issued}
            >
              <View style={{ flex: 1 }}>
                <Text variant="title">{r.rewardName}</Text>
                <Text variant="caption" color="textMuted">
                  Use by {formatDateWithYear(r.expiresAt)}
                </Text>
              </View>
              <Text variant="eyebrow" color="accent">
                Show code
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'rewards', label: 'Rewards' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>

      {tab === 'rewards' ? (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {catalogue?.map((r) => (
            <RewardRow
              key={r.id}
              reward={r}
              eligible={availableIds.has(r.id)}
              balance={account.balancePoints}
            />
          ))}
          {progress ? (
            <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Text variant="eyebrow" color="accent">
                {progress.current.name} benefits
              </Text>
              {progress.current.benefits.map((b) => (
                <Text key={b} variant="bodySmall">
                  · {b}
                </Text>
              ))}
            </Card>
          ) : null}
          {w.referralCode ? (
            <Card style={{ gap: spacing.xs }}>
              <Text variant="eyebrow" color="textMuted">
                Invite a friend
              </Text>
              <Text variant="h3" selectable>
                {w.referralCode}
              </Text>
              <Text variant="caption" color="textMuted">
                When a friend joins with your code and completes their first visit, you earn a
                thank-you in points.
              </Text>
            </Card>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          {history?.map((t) => (
            <View key={t.id} style={styles.tx}>
              <View style={{ flex: 1 }}>
                <Text variant="body">{t.description}</Text>
                <Text variant="caption" color="textSubtle">
                  {TX_LABEL[t.type]} · {formatDateShort(t.createdAt)}
                  {t.type === 'earn' && t.expiresAt
                    ? ` · expires ${formatDateWithYear(t.expiresAt)}`
                    : ''}
                </Text>
              </View>
              <Text variant="price" color={t.points > 0 ? 'success' : 'textMuted'}>
                {t.points > 0 ? '+' : '−'}
                {formatPoints(Math.abs(t.points))}
              </Text>
            </View>
          ))}
          {redemptions
            ?.filter((r) => r.status !== 'issued')
            .map((r) => (
              <View key={r.id} style={styles.tx}>
                <Text variant="bodySmall" color="textMuted" style={{ flex: 1 }}>
                  {r.rewardName}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {r.status === 'used'
                    ? `Enjoyed ${r.usedAt ? formatDateShort(r.usedAt) : ''}`
                    : r.status}
                </Text>
              </View>
            ))}
        </View>
      )}
    </Screen>
  );
}

function RewardRow({
  reward,
  eligible,
  balance,
}: {
  reward: Reward;
  eligible: boolean;
  balance: number;
}) {
  const affordable = balance >= reward.pointsCost;
  return (
    <Pressable
      onPress={() => router.push(`/rewards/${reward.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${reward.name}, ${reward.pointsCost} points${eligible ? '' : ', higher tier'}`}
      style={({ pressed }) => [
        styles.reward,
        pressed && { opacity: 0.8 },
        !eligible && { opacity: 0.6 },
      ]}
    >
      <Photo photo={reward.photo} label="" style={styles.rewardPhoto} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title">{reward.name}</Text>
        <Text variant="price" color="accent">
          {formatPoints(reward.pointsCost)} pts
        </Text>
        {!eligible ? (
          <ExperienceBadge label="Higher tier" tone="muted" />
        ) : affordable ? (
          <ExperienceBadge label="Available" />
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  joinPhoto: { height: 220, borderRadius: radius.md, marginTop: spacing.md },
  rule: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  card: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  track: { height: 3, backgroundColor: colors.borderStrong, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.accent },
  issued: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  reward: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  rewardPhoto: { width: 72, height: 72, borderRadius: radius.md },
  tx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
