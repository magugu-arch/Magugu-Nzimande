import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { SharingScope } from '@/core/domain/models';
import { formatDateLong, formatDayLong } from '@/core/time/sast';
import { useGuardianProfile, useGuardianUpdates } from '@/data/hooks';
import {
  Card,
  HeroBack,
  Icon,
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
import { recordAudit } from '@/state/governance';
import { useSession } from '@/state/session';
import { useEffect } from 'react';

const SCOPES: { scope: SharingScope; label: string; detail: string }[] = [
  { scope: 'key-dates', label: 'Key dates', detail: 'Term dates, exams and ceremonies' },
  { scope: 'fees', label: 'Fees', detail: 'Balance and due dates' },
  { scope: 'results', label: 'Results', detail: 'Published marks' },
  { scope: 'residence', label: 'Residence', detail: 'Room and residence notices' },
];

/**
 * The parent / guardian view (brief §3): intentionally narrow. It shows
 * what the student has chosen to share — and, just as clearly, what they
 * haven't. Only the student can change it.
 */
export default function Guardian() {
  const router = useRouter();
  const userId = useSession((s) => s.user?.id);
  const profile = useGuardianProfile();
  const student = profile.data?.linkedStudents[0];
  const updates = useGuardianUpdates(student?.studentId);

  useEffect(() => {
    if (userId && student) recordAudit('guardian.view', userId, `Viewed updates shared by ${student.givenName}`);
  }, [userId, student]);

  return (
    <Screen padded={false} topInset={false} testID="guardian">
      <PhotoHero photo="parentConnection" eyebrow="Family" title={student ? `Supporting ${student.givenName}` : 'Your student'} subtitle={student ? `${student.qualification}` : undefined} height={280} topBar={<HeroBack />} />
      <View style={styles.body}>
        <QueryState query={profile} what="your linked student" isEmpty={(p) => p.linkedStudents.length === 0} empty={<StateView kind="empty" title="No linked student" body="A student links a parent or guardian from their own NMU ONE." />}>
          {(p) => {
            const s = p.linkedStudents[0]!;
            return (
              <View style={{ gap: spacing.xl }}>
                <View>
                  <SectionHeader title={`What ${s.givenName} shares with you`} />
                  <Card padded={false} style={styles.list}>
                    {SCOPES.map((x) => {
                      const shared = s.sharing.includes(x.scope);
                      return (
                        <ListRow
                          key={x.scope}
                          icon={shared ? 'checkmark-circle' : 'lock-closed-outline'}
                          iconTone={shared ? 'success' : 'sunken'}
                          title={x.label}
                          subtitle={shared ? x.detail : 'Not shared'}
                          trailing={shared ? <Pill label="Shared" tone="success" /> : <Pill label="Private" />}
                          onPress={shared && x.scope === 'fees' ? () => router.push('/guardian/fees') : undefined}
                        />
                      );
                    })}
                  </Card>
                  <Row gap={spacing.sm} align="flex-start" style={{ marginTop: spacing.sm }}>
                    <Icon name="information-circle-outline" size={18} color={colors.textSecondary} />
                    <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                      {s.givenName} chooses what you see, and can change it at any time. Last changed {formatDateLong(s.sharingUpdatedAt)}.
                    </Text>
                  </Row>
                </View>

                <View>
                  <SectionHeader title="Updates" />
                  <QueryState query={updates} what="updates" isEmpty={(u) => u.length === 0} empty={<StateView kind="empty" title="No updates yet" />}>
                    {(list) => (
                      <Card padded={false} style={styles.list}>
                        {list.map((u) => (
                          <ListRow
                            key={u.id}
                            icon={u.scope === 'fees' ? 'wallet-outline' : 'calendar-outline'}
                            title={u.title}
                            subtitle={u.body}
                            meta={formatDayLong(u.at)}
                            onPress={u.href && u.href !== '/guardian' ? () => router.push(u.href as Href) : undefined}
                          />
                        ))}
                      </Card>
                    )}
                  </QueryState>
                </View>

                <View>
                  <SectionHeader title="Help for families" />
                  <Card padded={false} style={styles.list}>
                    <ListRow icon="shield-checkmark-outline" title="Safety on campus" subtitle="Emergency numbers and Campus Protection" onPress={() => router.push('/safety')} />
                    <ListRow icon="heart-outline" title="Student wellbeing" subtitle="How students are supported" onPress={() => router.push('/wellbeing')} />
                    <ListRow icon="map-outline" title="Visiting campus" subtitle="Map and directions" onPress={() => router.push('/campus-map')} />
                  </Card>
                </View>
              </View>
            );
          }}
        </QueryState>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter },
  list: { paddingHorizontal: spacing.lg },
});
