import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDateLong } from '@/core/time/sast';
import { useResidence } from '@/data/hooks';
import {
  Button,
  Card,
  HeroBack,
  ListRow,
  PhotoHero,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  StateView,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';

const STATUS = {
  submitted: { label: 'Submitted', tone: 'info' },
  'in-progress': { label: 'In progress', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
} as const;

/** Residence (brief §9): allocation, check-in, requests and support. */
export default function ResidenceScreen() {
  const router = useRouter();
  const residence = useResidence();
  const canRequest = useCan('residence.request');

  return (
    <Screen padded={false} topInset={false} testID="residence">
      <PhotoHero
        photo="residence"
        eyebrow="Residence"
        title="Home on campus"
        height={260}
        topBar={<HeroBack />}
      />
      <View style={styles.body}>
        <QueryState
          query={residence}
          what="your residence"
          isEmpty={(r) => r === null}
          empty={
            <StateView
              kind="empty"
              title="No residence allocation"
              body="You don’t hold a residence place this year. The residence office can help with applications."
            />
          }
        >
          {(r) =>
            r ? (
              <View style={{ gap: spacing.xl }}>
                <Card tone="navy">
                  <Text variant="overline" color={colors.yellow}>
                    Your room
                  </Text>
                  <Text variant="title1" color={colors.white}>
                    {r.block}, room {r.room}
                  </Text>
                  <Text variant="body" color={colors.textOnDarkMuted}>
                    {r.name}
                  </Text>
                  <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                    <Pill
                      label={
                        r.checkIn.status === 'complete'
                          ? `Checked in ${formatDateLong(r.checkIn.date)}`
                          : `Check-in due ${formatDateLong(r.checkIn.date)}`
                      }
                      tone={r.checkIn.status === 'complete' ? 'onDark' : 'yellow'}
                    />
                  </Row>
                </Card>

                {canRequest ? (
                  <Button
                    label="Log a request"
                    icon="construct"
                    variant="accent"
                    fullWidth
                    onPress={() => router.push('/residence/request')}
                    testID="residence-new-request"
                  />
                ) : null}

                <View>
                  <SectionHeader title="Your requests" />
                  {r.requests.length ? (
                    <Card padded={false} style={styles.list}>
                      {r.requests.map((q) => (
                        <ListRow
                          key={q.id}
                          icon="construct-outline"
                          title={q.description}
                          subtitle={`${q.reference} · ${formatDateLong(q.createdAt)}`}
                          trailing={
                            <Pill label={STATUS[q.status].label} tone={STATUS[q.status].tone} />
                          }
                        />
                      ))}
                    </Card>
                  ) : (
                    <Card tone="sunken">
                      <Text variant="body" color={colors.textSecondary}>
                        No requests yet.
                      </Text>
                    </Card>
                  )}
                </View>

                <View>
                  <SectionHeader title="Support" />
                  <Card padded={false} style={styles.list}>
                    <ListRow
                      icon="business-outline"
                      title={r.office.name}
                      subtitle={r.office.hours}
                      onPress={() => router.push('/campus-map?to=RV')}
                    />
                    <ListRow
                      icon="shield-checkmark-outline"
                      title="Safety after hours"
                      subtitle="Emergency numbers and the late-night shuttle"
                      onPress={() => router.push('/safety')}
                    />
                  </Card>
                </View>
              </View>
            ) : null
          }
        </QueryState>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter, gap: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
