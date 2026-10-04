import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMoney } from '@/core/domain/money';
import { formatAgo, formatDayLong, formatTime } from '@/core/time/sast';
import { useFunding } from '@/data/hooks';
import {
  Card,
  Header,
  ListRow,
  Notice,
  Pill,
  QueryState,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  colors,
  spacing,
} from '@/design';
import { useNow } from '@/features/system/useNow';

const STATUS = {
  paid: { label: 'Paid', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  delayed: { label: 'Delayed', tone: 'warning' },
} as const;

/**
 * Funding status (brief §8; the "Better" notice in §5 lands here). States
 * what the funder has and hasn't released, who reported it and when — and
 * says plainly when there is no new date rather than inventing one.
 */
export default function Funding() {
  const router = useRouter();
  const now = useNow();
  const funding = useFunding();

  return (
    <Screen header={<Header title="Funding" fallbackHref="/money" />} onRefresh={funding.refetch} testID="funding">
      <QueryState query={funding} what="your funding status" loading={<SkeletonCard lines={5} />}>
        {(f) => (
          <View style={styles.body}>
            <View style={{ gap: spacing.xs }}>
              <Text variant="overline" color={colors.textSecondary}>
                {f.providerName}
              </Text>
              <Text variant="title1" accessibilityRole="header">
                {f.headline}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                Reported by Student Funding · updated {formatAgo(f.updatedAt, now).toLowerCase()} ({formatTime(f.updatedAt)})
              </Text>
            </View>

            {f.status === 'delayed' ? (
              <Notice
                tone="warning"
                title={f.expectedBy ? `Expected by ${formatDayLong(f.expectedBy)}` : 'No new payment date yet'}
                body={f.detail}
              />
            ) : (
              <Notice tone="success" title="Your funding is on track" body={f.detail} />
            )}

            <View>
              <SectionHeader title="What has been released" />
              <Card padded={false} style={styles.list}>
                {f.allowances.map((a) => (
                  <ListRow
                    key={a.label}
                    title={a.label}
                    subtitle={formatMoney(a.amount)}
                    trailing={<Pill label={STATUS[a.status].label} tone={STATUS[a.status].tone} />}
                  />
                ))}
              </Card>
            </View>

            <View>
              <SectionHeader title="Need help?" />
              <Card padded={false} style={styles.list}>
                <ListRow icon="people-outline" title="Student Funding office" subtitle="Administration building, weekdays" onPress={() => router.push('/campus-map?to=AD')} />
                <ListRow icon="restaurant-outline" title="Food support" subtitle="Confidential help while you wait" onPress={() => router.push('/wellbeing')} />
              </Card>
            </View>
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
