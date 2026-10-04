import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { findBuilding, parseRoomCode, routeTo } from '@/core/campus/routing';
import { useCampusMap, useTimetableToday } from '@/data/hooks';
import {
  Button,
  Card,
  ChipRow,
  Header,
  Icon,
  ListRow,
  Notice,
  QueryState,
  Row,
  Screen,
  SearchField,
  SectionHeader,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { nextClass } from '@/features/academics/timetable';
import { CampusMapView } from '@/features/campus/CampusMapView';
import { useNow } from '@/features/system/useNow';

type LocationState = 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable';

/**
 * Wayfinding (brief §9): searchable buildings, "You are here", route guidance
 * and "Take me to my next class". The route is always also given as text.
 */
export default function CampusMapScreen() {
  const params = useLocalSearchParams<{ to?: string }>();
  const now = useNow();
  const map = useCampusMap();
  const canTimetable = useCan('academics.timetable');
  const timetable = useTimetableToday(canTimetable);
  const [origin, setOrigin] = useState<string>('gate');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<LocationState>('idle');
  const [selected, setSelected] = useState<string | null>(params.to ?? null);

  const next = timetable.data ? nextClass(timetable.data, now) : null;

  const askLocation = async () => {
    setLocation('asking');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation('denied');
        return;
      }
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      // The schematic map has no GPS projection yet, so a fix snaps to the
      // nearest entrance. The live CampusProvider supplies real geometry.
      setOrigin('gate');
      setLocation('granted');
    } catch {
      setLocation('unavailable');
    }
  };

  const results = useMemo(() => {
    if (!map.data || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return map.data.buildings.filter(
      (b) => b.code.toLowerCase().startsWith(q.replace(/\d.*$/, '')) || b.name.toLowerCase().includes(q) || b.facilities.some((f) => f.toLowerCase().includes(q)),
    );
  }, [map.data, query]);

  return (
    <Screen header={<Header title="Campus map" />} testID="campus-map">
      <QueryState query={map} what="the campus map">
        {(m) => {
          const building = selected ? findBuilding(m, selected) : null;
          const room = selected ? parseRoomCode(selected) : null;
          const route = building ? routeTo(m, origin, building, room?.floor) : null;
          const originLabel = m.waypoints.find((w) => w.id === origin)?.label ?? 'your start';
          return (
            <View style={styles.body}>
              <SearchField
                value={query}
                onChangeText={setQuery}
                onClear={() => setQuery('')}
                label="Find a building, room or facility"
                testID="map-search"
              />
              {results.length ? (
                <Card padded={false} style={styles.list}>
                  {results.map((b) => (
                    <ListRow
                      key={b.id}
                      icon="business-outline"
                      title={`${b.name} (${b.code})`}
                      subtitle={b.facilities.slice(0, 3).join(' · ')}
                      onPress={() => {
                        setSelected(b.code);
                        setQuery('');
                      }}
                    />
                  ))}
                </Card>
              ) : null}

              {!selected && next ? (
                <Button label={`Take me to my next class · ${next.room.code}`} icon="navigate" variant="accent" fullWidth onPress={() => setSelected(next.room.code)} testID="map-next-class" />
              ) : null}

              <CampusMapView
                map={m}
                route={route}
                highlight={building?.id}
                origin={origin}
                onSelectBuilding={(b) => setSelected(b.code)}
                height={380}
                label={building ? `Map of ${m.name} with a route from ${originLabel} to ${building.name}` : `Map of ${m.name}. You are at ${originLabel}.`}
              />

              <View>
                <SectionHeader title="Starting from" />
                <ChipRow
                  value={origin}
                  onChange={setOrigin}
                  options={[
                    { value: 'gate', label: 'Main Gate', icon: 'navigate-circle-outline' },
                    { value: 'res', label: 'Residence', icon: 'home-outline' },
                    { value: 'shuttle', label: 'Shuttle stop', icon: 'bus-outline' },
                    { value: 'w4', label: 'Library Square', icon: 'book-outline' },
                  ]}
                />
                <Row style={{ marginTop: spacing.sm }}>
                  <Button label={location === 'asking' ? 'Finding you…' : 'Use my location'} icon="locate" variant="ghost" size="md" loading={location === 'asking'} onPress={askLocation} />
                </Row>
                {location === 'granted' ? (
                  <Notice tone="info" title="Location found" body="This schematic map can’t place GPS positions yet, so your route starts from the nearest entrance, the Main Gate." />
                ) : location === 'denied' ? (
                  <Notice tone="neutral" icon="lock-closed-outline" title="Location is off" body={`NMU ONE only uses location when you ask. Choose where you’re starting from above${Platform.OS === 'web' ? '' : ', or allow location in Settings'}.`} />
                ) : location === 'unavailable' ? (
                  <Notice tone="warning" title="Couldn’t find your location" body="Choose where you’re starting from above." />
                ) : null}
              </View>

              {building ? (
                <Card testID="route-card">
                  <Text variant="overline" color={colors.textSecondary}>
                    {room ? `Room ${room.code}` : 'Destination'}
                  </Text>
                  <Text variant="title2">{building.name}</Text>
                  {route ? (
                    <>
                      <Row gap={spacing.lg} style={{ marginVertical: spacing.md }}>
                        <Row gap={spacing.xs}>
                          <Icon name="walk" size={18} color={colors.navy2} />
                          <Text variant="bodyStrong">{route.walkingMinutes} min</Text>
                        </Row>
                        <Text variant="body" color={colors.textSecondary}>
                          {route.metres} m from {originLabel}
                        </Text>
                      </Row>
                      <View accessibilityRole="list" style={{ gap: spacing.sm }}>
                        {route.steps.map((step, i) => (
                          <Row key={step} gap={spacing.md} align="flex-start">
                            <View style={styles.step}>
                              <Text variant="captionStrong" color={colors.navy}>
                                {i + 1}
                              </Text>
                            </View>
                            <Text variant="body" style={{ flex: 1 }}>
                              {step}
                            </Text>
                          </Row>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text variant="body" color={colors.textSecondary}>
                      No walking route from here.
                    </Text>
                  )}
                  <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
                    {building.accessibility}
                  </Text>
                </Card>
              ) : null}

              <View>
                <SectionHeader title="Buildings" />
                <Card padded={false} style={styles.list}>
                  {[...m.buildings]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((b) => (
                      <ListRow key={b.id} icon="business-outline" title={b.name} subtitle={`${b.code} · ${b.facilities.slice(0, 2).join(' · ')}`} onPress={() => setSelected(b.code)} />
                    ))}
                </Card>
                <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
                  Schematic map for demonstration. The live service uses NMU’s own building register.
                </Text>
              </View>

            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  list: { paddingHorizontal: spacing.lg },
  step: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
});
