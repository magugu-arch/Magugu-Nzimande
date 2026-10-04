import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatTime } from '@/core/time/sast';
import { useArrivals, useShuttleRoutes } from '@/data/hooks';
import { Card, Header, Notice, Pill, QueryState, Row, Screen, StateView, Text, colors, spacing } from '@/design';

/** One route: every stop, the next vehicle at each, and its status. */
export default function RouteDetail() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const router = useRouter();
  const routes = useShuttleRoutes();
  const arrivals = useArrivals();

  return (
    <Screen header={<Header title="Route" fallbackHref="/transport" />} onRefresh={arrivals.refetch} testID="route-detail">
      <QueryState query={routes} what="this route">
        {(list) => {
          const r = list.find((x) => x.id === routeId);
          if (!r) return <StateView kind="empty" title="Route not found" actionLabel="All routes" onAction={() => router.replace('/transport')} />;
          const running = r.status !== 'not-running';
          return (
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <Text variant="overline" color={colors.textSecondary}>
                  Route {r.code}
                </Text>
                <Text variant="title1" accessibilityRole="header">
                  {r.name}
                </Text>
                <Text variant="body" color={colors.textSecondary}>
                  Every {r.frequencyMinutes} min · first {r.firstDeparture} · last {r.lastDeparture}
                </Text>
              </View>
              {r.status !== 'on-time' && r.statusNote ? <Notice tone={running ? 'warning' : 'neutral'} title={running ? 'Running late' : 'Not running now'} body={r.statusNote} /> : null}
              <Card>
                {r.stops.map((stop, i) => {
                  const a = arrivals.data?.find((x) => x.routeId === r.id && x.stopId === stop.id);
                  const last = i === r.stops.length - 1;
                  return (
                    <Row key={stop.id} align="flex-start" gap={spacing.md}>
                      <View style={styles.rail}>
                        <View style={[styles.node, i === 0 ? styles.nodeFirst : null]} />
                        {!last ? <View style={styles.line} /> : null}
                      </View>
                      <View style={[styles.stop, last ? null : { paddingBottom: spacing.xl }]} accessible accessibilityLabel={`${stop.name}. ${a && running ? `Next shuttle in ${a.etaMinutes} minutes, ${formatTime(a.departsAt)}` : 'No shuttle now'}`}>
                        <Row justify="space-between">
                          <Text variant="label">{stop.name}</Text>
                          {a && running ? <Pill label={`${a.etaMinutes} min`} tone={i === 0 ? 'yellow' : 'neutral'} /> : null}
                        </Row>
                        {a ? (
                          <Text variant="caption" color={colors.textSecondary}>
                            {running ? `Next at ${formatTime(a.departsAt)}` : `First at ${formatTime(a.departsAt)}`}
                            {a.live ? ' · live' : ' · timetabled'}
                          </Text>
                        ) : null}
                      </View>
                    </Row>
                  );
                })}
              </Card>
              <Text variant="caption" color={colors.textSecondary}>
                Live times come from vehicle tracking where it’s fitted; otherwise from the timetable, and say so.
              </Text>
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rail: { width: 18, alignItems: 'center' },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: colors.navy, backgroundColor: colors.white, marginTop: 4 },
  nodeFirst: { backgroundColor: colors.yellow },
  line: { width: 3, flex: 1, backgroundColor: colors.navy, marginTop: 2 },
  stop: { flex: 1, gap: 2 },
});
