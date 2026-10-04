import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMoney, moneyAccessibilityLabel } from '@/core/domain/money';
import { formatDateLong, formatDayShort, formatRelativeDay, formatTime } from '@/core/time/sast';
import { useAccount, useFunding, useTransactions } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  ListRow,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  SkeletonCard,
  StateView,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { useNow } from '@/features/system/useNow';

/**
 * Fees (brief §8, §26 step 5): reduce uncertainty. What you owe, by when,
 * as at when — and never a stale figure presented as current (§25).
 */
export default function Fees() {
  const router = useRouter();
  const now = useNow();
  const account = useAccount();
  const funding = useFunding();
  const transactions = useTransactions();
  const canPay = useCan('finance.pay');

  return (
    <Screen
      header={<Header title="Fees" largeTitle="Fees & funding" eyebrow="Money" />}
      onRefresh={() => {
        account.refetch();
        transactions.refetch();
        funding.refetch();
      }}
      testID="fees"
    >
      <QueryState query={account} what="your fee account" loading={<SkeletonCard lines={4} />}>
        {(a) => {
          const owing = a.balance.cents > 0;
          return (
            <Card tone="navy" testID="balance-card">
              <Text variant="overline" color={colors.yellow}>
                {owing ? 'Amount due' : a.balance.cents < 0 ? 'In credit' : 'Balance'}
              </Text>
              <Text
                variant="metric"
                color={colors.white}
                style={{ marginTop: spacing.xs }}
                accessibilityLabel={
                  owing ? `${moneyAccessibilityLabel(a.balance)} owed` : 'Nothing owed'
                }
              >
                {a.balance.cents < 0
                  ? formatMoney({ ...a.balance, cents: -a.balance.cents })
                  : formatMoney(a.balance)}
              </Text>
              {owing && a.dueDate ? (
                <Text variant="bodyLarge" color={colors.white}>
                  Due {formatDayShort(a.dueDate)}
                </Text>
              ) : (
                <Text variant="bodyLarge" color={colors.white}>
                  You’re fully paid up
                </Text>
              )}
              <Text
                variant="caption"
                color={colors.textOnDarkMuted}
                style={{ marginTop: spacing.sm }}
              >
                From Student Finance · as at {formatTime(a.asAt)}{' '}
                {formatRelativeDay(a.asAt, now).toLowerCase()}
              </Text>
              {owing && canPay ? (
                <Row gap={spacing.sm} style={{ marginTop: spacing.lg }} wrap>
                  <Button
                    label="Make a payment"
                    icon="card"
                    variant="accent"
                    onPress={() => router.push('/money/pay')}
                    testID="fees-pay"
                  />
                </Row>
              ) : null}
            </Card>
          );
        }}
      </QueryState>

      <View style={styles.section}>
        <SectionHeader
          title="Funding"
          action="Details"
          onAction={() => router.push('/money/funding')}
        />
        <QueryState query={funding} what="your funding status" loading={<SkeletonCard lines={2} />}>
          {(f) => (
            <Card
              onPress={() => router.push('/money/funding')}
              accessibilityLabel={`${f.providerName}: ${f.headline}. View funding status.`}
              testID="funding-summary"
            >
              <Row justify="space-between">
                <Text variant="title3">{f.providerName}</Text>
                <Pill
                  label={
                    f.status === 'delayed'
                      ? 'Payment delayed'
                      : f.status === 'approved'
                        ? 'Approved'
                        : f.status === 'pending'
                          ? 'Pending'
                          : 'Not applicable'
                  }
                  tone={
                    f.status === 'delayed'
                      ? 'warning'
                      : f.status === 'approved'
                        ? 'success'
                        : 'neutral'
                  }
                />
              </Row>
              <Text variant="body" style={{ marginTop: spacing.xs }}>
                {f.headline}
              </Text>
              <Text variant="captionStrong" color={colors.navy2} style={{ marginTop: spacing.sm }}>
                View funding status →
              </Text>
            </Card>
          )}
        </QueryState>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Statement" />
        <QueryState
          query={transactions}
          what="your statement"
          isEmpty={(t) => t.length === 0}
          empty={<StateView kind="empty" title="No transactions yet" />}
        >
          {(list) => (
            <Card padded={false} style={styles.list}>
              {list.map((t) => (
                <ListRow
                  key={t.id}
                  icon={
                    t.kind === 'charge'
                      ? 'document-text-outline'
                      : t.kind === 'funding'
                        ? 'school-outline'
                        : 'checkmark-circle-outline'
                  }
                  iconTone={t.amount.cents < 0 ? 'success' : 'sunken'}
                  title={t.description}
                  subtitle={`${formatDateLong(t.date)} · ${t.reference}`}
                  trailing={
                    <Text
                      variant="bodyStrong"
                      color={t.amount.cents < 0 ? colors.success : colors.textPrimary}
                      accessibilityLabel={`${t.amount.cents < 0 ? 'credit' : 'charge'} ${moneyAccessibilityLabel({ ...t.amount, cents: Math.abs(t.amount.cents) })}`}
                    >
                      {formatMoney(t.amount, { signed: true })}
                    </Text>
                  }
                />
              ))}
            </Card>
          )}
        </QueryState>
      </View>

      <Text variant="caption" color={colors.textSecondary} style={styles.section}>
        Questions about your account? Student Finance is in the Administration building, weekdays.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
