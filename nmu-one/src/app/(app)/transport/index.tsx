import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatTime } from '@/core/time/sast';
import { useArrivals, useDisruptions, useShuttleRoutes } from '@/data/hooks';
import {
  Card,
  Header,
  Icon,
  Notice,
  Photo,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  Text,
  colors,
  radius,
  spacing,
} from '@/design';

/**
 * Shuttle (brief §9, §26 step 7): routes, live ETAs where tracking supports
 * it, route status, disruptions and late-night service.
 */
export default function Transport() {
  const router = useRouter();
  const routes = useShuttleRoutes();
  const arrivals = useArrivals();
  const disruptions = useDisruptions();

  return (
    <Screen header={<Header title="Shuttle" />} onRefresh={() => { routes.refetch(); arrivals.refetch(); }} testID="transport">
      <View style={styles.hero}>
        <Photo photo="shuttle" size="md" style={styles.heroPhoto} decorative />
        <Text variant="title1" accessibilityRole="header">
          Campus shuttle
        </Text>
        <Text variant="body" color={colors.textSecondary}>
          Live times from the Shuttle Interchange, refreshed every 30 seconds.
        </Text>
      </View>

      {disruptions.data?.length ? (
        <View style={styles.section}>
          {disruptions.data.map((d) => (
            <Notice key={d.id} tone={d.severity === 'major' ? 'danger' : 'warning'} title={d.title} body={d.detail} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Routes" />
        <QueryState query={routes} what="shuttle routes">
          {(list) => (
            <View style={{ gap: spacing.md }}>
              {list.map((r) => {
                const a = arrivals.data?.find((x) => x.routeId === r.id && x.stopId === r.stops[0]?.id);
                const running = r.status !== 'not-running';
                return (
                  <Card
                    key={r.id}
                    onPress={() => router.push(`/transport/${r.id}`)}
                    accessibilityLabel={`Route ${r.code}, ${r.name}. ${running && a ? `Next departure in ${a.etaMinutes} minutes at ${formatTime(a.departsAt)}.` : (r.statusNote ?? 'Not running.')}`}
                    testID={`route-${r.code}`}
                  >
                    <Row gap={spacing.md}>
                      <View style={[styles.code, !running ? styles.codeOff : null]}>
                        <Text variant="title2" color={running ? colors.navy : colors.textSecondary}>
                          {r.code}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="label">{r.name}</Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          Every {r.frequencyMinutes} min · {r.firstDeparture}–{r.lastDeparture}
                          {r.lateNight ? ' · late night' : ''}
                        </Text>
                        <Row gap={spacing.xs} style={{ marginTop: spacing.xs }} wrap>
                          {r.status === 'on-time' ? <Pill label="On time" tone="success" /> : null}
                          {r.status === 'delayed' ? <Pill label="Delayed" tone="warning" /> : null}
                          {r.status === 'not-running' ? <Pill label="Not running now" /> : null}
                          {a?.live ? <Pill label="Live tracking" tone="info" icon="radio-outline" /> : null}
                        </Row>
                      </View>
                      {running && a ? (
                        <View style={styles.eta}>
                          <Text variant="metricSmall">{a.etaMinutes}</Text>
                          <Text variant="caption" color={colors.textSecondary}>
                            min
                          </Text>
                        </View>
                      ) : (
                        <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
                      )}
                    </Row>
                    {r.statusNote && r.status !== 'on-time' ? (
                      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
                        {r.statusNote}
                      </Text>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </QueryState>
      </View>

      <Card tone="navy" onPress={() => router.push('/safety')} style={styles.section} accessibilityLabel="Travelling late? Safety tools and the late-night loop.">
        <Row gap={spacing.md}>
          <Icon name="moon" size={24} color={colors.yellow} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" color={colors.white}>
              Travelling late?
            </Text>
            <Text variant="caption" color={colors.textOnDarkMuted}>
              Route N loops to the residences every 30 minutes from 18:00. You can share your location with Campus Protection on the way.
            </Text>
          </View>
        </Row>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs },
  heroPhoto: { height: 150, marginBottom: spacing.md },
  section: { marginTop: spacing.xl, gap: spacing.sm },
  code: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  codeOff: { backgroundColor: colors.surfaceSunken },
  eta: { alignItems: 'center', minWidth: 44 },
});
