import {
  canTransact,
  formatShortDate,
  type Benefit,
  type RewardTransaction,
} from '@scarlets/domain';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, PlacementTag, Tag } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { BarButton, Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { ListRow, RowGroup, SectionHeader } from '@/components/Rows';
import { Sheet } from '@/components/Sheet';
import { ErrorState, Notice, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { usePassport } from '@/data/queries';
import { PassportCard } from '@/features/passport/PassportCard';
import { useL, useLocale, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { useSession } from '@/state/session';
import { radius, space, useTheme } from '@/theme';

const TXN_TONE: Record<RewardTransaction['type'], 'success' | 'warning' | 'neutral' | 'gold'> = {
  earned: 'success',
  pending: 'warning',
  redeemed: 'gold',
  expired: 'neutral',
  reversed: 'neutral',
};

export default function PassportScreen() {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const theme = useTheme();
  const router = useRouter();
  const query = usePassport();
  const signOut = useSession((s) => s.signOut);
  const [benefit, setBenefit] = useState<Benefit | null>(null);
  const payload = query.data;
  const passport = payload?.passport.data ?? null;
  const meta = payload?.passport.meta;
  const linked = passport?.membership.state === 'linked';

  useEffect(() => {
    track('passport_open', { placement: 'tab' });
  }, []);

  return (
    <Page
      testID="screen-passport"
      title={t('passport.title')}
      inTabs
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching && !query.isPending}
      actions={
        <BarButton icon="menu" label={t('common.more')} onPress={() => router.push('/more')} />
      }
    >
      {query.isPending ? <SkeletonList rows={5} /> : null}
      {query.isError && !payload ? <ErrorState onRetry={() => void query.refetch()} /> : null}

      {payload && payload.account === 'guest' ? (
        <View style={{ gap: space.lg }} testID="passport-guest">
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <Photo id="passport-phone" style={{ height: 250 }} />
            <View style={{ padding: space.lg, gap: space.sm }}>
              <Text variant="title2" accessibilityRole="header">
                {t('passport.guest.title')}
              </Text>
              <Text variant="body" color="textSecondary">
                {t('passport.guest.body')}
              </Text>
              <Button
                testID="passport-sign-in"
                label={t('common.signIn')}
                icon="person-circle"
                fill
                style={{ marginTop: space.sm }}
                onPress={() => {
                  track('membership_cta_tap', { placement: 'passport_guest' });
                  router.push('/sign-in');
                }}
              />
            </View>
          </Card>
          <Notice icon="flask-outline" body={t('concept.banner')} />
        </View>
      ) : null}

      {payload && passport && meta ? (
        <View style={{ gap: space.xxl }}>
          <View style={{ gap: space.md }}>
            <PassportCard passport={passport} />
            <DataStamp meta={meta} showNotice />
          </View>

          {!linked ? (
            <Notice
              icon="link-outline"
              title={t('passport.notLinked.title')}
              body={`${t('passport.notLinked.body')} ${t('passport.link.note')}`}
              action={{ label: t('passport.link.cta'), onPress: () => router.push('/sign-in') }}
              testID="passport-link"
            />
          ) : null}

          {/* YMLAEN: what the club has announced, and nothing it has not. */}
          <Card tone="inverse" testID="programme" style={{ gap: space.md }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: space.md,
              }}
            >
              <Text
                variant="title1"
                color="goldOnInverse"
                accessibilityRole="header"
                style={{ letterSpacing: 1.5 }}
              >
                {passport.programme.name}
              </Text>
              <Tag label={t('passport.programme.announced')} tone="onDark" />
            </View>
            <Text variant="callout" color="onInverse">
              {l(passport.programme.statement)}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: theme.inverseRaised,
              }}
            >
              <Icon name="hourglass-outline" size={18} color="#D9C9CC" />
              <Text variant="footnote" color="onInverseMuted" style={{ flex: 1 }}>
                {passport.programme.balance === null
                  ? t('passport.programme.noBalance')
                  : String(passport.programme.balance)}
              </Text>
            </View>
          </Card>

          <View style={{ gap: space.md }}>
            <SectionHeader title={t('passport.benefits')} />
            {passport.benefits.length === 0 ? (
              <Notice icon="ribbon-outline" body={t('passport.benefits.none')} />
            ) : (
              <RowGroup>
                {passport.benefits.map((item) => (
                  <ListRow
                    key={item.id}
                    testID={`benefit-${item.id}`}
                    icon={item.icon}
                    title={l(item.title)}
                    subtitle={t('passport.benefit.awaiting')}
                    onPress={() => {
                      track('offer_view', { offer_id: item.id, placement: 'passport_benefits' });
                      setBenefit(item);
                    }}
                  />
                ))}
              </RowGroup>
            )}
          </View>

          <View style={{ gap: space.md }}>
            <SectionHeader title={t('passport.missions')} />
            <RowGroup>
              {passport.missions.map((mission) => (
                <View
                  key={mission.id}
                  accessible
                  accessibilityLabel={`${l(mission.title)}. ${l(mission.detail)} ${t('passport.mission.proposed')}.`}
                  style={{
                    flexDirection: 'row',
                    gap: space.md,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      borderCurve: 'continuous',
                      backgroundColor: theme.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={mission.icon} size={19} color={theme.accentText} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="headline">{l(mission.title)}</Text>
                    <Text variant="footnote" color="textSecondary">
                      {l(mission.detail)}
                    </Text>
                    <Tag
                      label={t('passport.mission.proposed')}
                      icon="hourglass-outline"
                      tone="warning"
                      style={{ marginTop: 2 }}
                    />
                  </View>
                </View>
              ))}
            </RowGroup>
          </View>

          <View style={{ gap: space.md }}>
            <SectionHeader title={t('passport.rewards')} />
            <Card padded={false} testID="rewards-locked" style={{ overflow: 'hidden' }}>
              <Photo id="reward-redemption" style={{ height: 170 }} />
              <View style={{ padding: space.lg, gap: space.xs }}>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Icon name="lock-closed" size={16} color={theme.textSecondary} />
                  <Text variant="title3">{t('passport.rewards.locked.title')}</Text>
                </View>
                <Text variant="callout" color="textSecondary">
                  {t('passport.rewards.locked.body')}
                </Text>
              </View>
            </Card>
            {payload.offer ? (
              <Card testID="passport-offer" style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <PlacementTag label={payload.offer.label} />
                  <DemoChip />
                </View>
                <Text variant="title3">{l(payload.offer.title)}</Text>
                <Text variant="callout" color="textSecondary">
                  {l(payload.offer.body)}
                </Text>
                {!canTransact(meta) ? (
                  <Text variant="footnote" color="warning">
                    {t('passport.paused')}
                  </Text>
                ) : null}
              </Card>
            ) : null}
          </View>

          <View style={{ gap: space.md }}>
            <SectionHeader title={t('passport.history')} />
            {passport.history.length === 0 ? (
              <Notice icon="time-outline" body={t('passport.history.none')} />
            ) : (
              <RowGroup>
                {passport.history.map((entry) => (
                  <View
                    key={entry.id}
                    accessible
                    accessibilityLabel={`${t(`txn.${entry.type}` as MessageKey)}. ${l(entry.title)}. ${formatShortDate(entry.occurredAt, 'Europe/London', locale)}`}
                    style={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: space.md,
                      }}
                    >
                      <Text variant="headline" style={{ flex: 1 }}>
                        {l(entry.title)}
                      </Text>
                      <Tag
                        label={t(`txn.${entry.type}` as MessageKey)}
                        tone={TXN_TONE[entry.type]}
                      />
                    </View>
                    <Text variant="footnote" color="textSecondary" numeric>
                      {formatShortDate(entry.occurredAt, 'Europe/London', locale)}
                      {entry.reference ? ` · ${entry.reference}` : ''}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {entry.amount === null ? t('passport.history.value') : String(entry.amount)}
                    </Text>
                  </View>
                ))}
              </RowGroup>
            )}
          </View>

          <Button
            testID="passport-sign-out"
            label={t('common.signOut')}
            variant="secondary"
            fill
            onPress={signOut}
          />
        </View>
      ) : null}

      <Sheet
        visible={benefit !== null}
        onClose={() => setBenefit(null)}
        title={benefit ? l(benefit.title) : ''}
        testID="benefit-sheet"
      >
        {benefit ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Tag label={t('passport.benefit.source')} icon="shield-checkmark-outline" />
              <Tag label={t('passport.benefit.awaiting')} icon="hourglass-outline" tone="warning" />
            </View>
            <Text variant="body">{l(benefit.detail)}</Text>
            <Notice
              icon="information-circle-outline"
              body={t('passport.benefit.redeem.unavailable')}
            />
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}
