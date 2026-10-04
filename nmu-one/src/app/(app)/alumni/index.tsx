import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDayShort } from '@/core/time/sast';
import { useAlumniProfile, useChapters, useStories } from '@/data/hooks';
import {
  Card,
  HeroBack,
  ListRow,
  Pill,
  PhotoHero,
  ProgressBar,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  Text,
  colors,
  spacing,
} from '@/design';
import { GivingModule, JobsModule, MentoringModule } from '@/features/home/RoleModules';

/** The alumni world (brief §14): profile, mentoring, careers, chapters, giving, stories. */
export default function AlumniHome() {
  const router = useRouter();
  const profile = useAlumniProfile();
  const chapters = useChapters();
  const stories = useStories();

  return (
    <Screen padded={false} topInset={false} testID="alumni">
      <PhotoHero photo="nmuCommunity" eyebrow="Alumni" title="Different backgrounds. A shared future." height={300} topBar={<HeroBack />} />
      <View style={styles.body}>
        <QueryState query={profile} what="your alumni profile">
          {(p) => (
            <Card testID="alumni-profile">
              <Text variant="overline" color={colors.textSecondary}>
                Class of {p.graduationYear}
              </Text>
              <Text variant="title3">{p.qualification}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {[p.industry, p.chapter].filter(Boolean).join(' · ')}
              </Text>
              <Row wrap gap={spacing.xs} style={{ marginVertical: spacing.sm }}>
                {p.expertise.map((e) => (
                  <Pill key={e} label={e} />
                ))}
              </Row>
              <ProgressBar value={p.profileCompleteness} tone="yellow" label={`Profile ${Math.round(p.profileCompleteness * 100)}% complete`} />
              <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                Profile {Math.round(p.profileCompleteness * 100)}% complete · a fuller profile gets better mentoring matches
              </Text>
            </Card>
          )}
        </QueryState>

        <MentoringModule />
        <GivingModule />
        <JobsModule />

        <View>
          <SectionHeader title="Chapters" />
          <Card padded={false} style={styles.list}>
            {chapters.data?.map((c) => (
              <ListRow key={c.id} icon="globe-outline" title={c.name} subtitle={`${c.members.toLocaleString('en-ZA')} members${c.nextMeetup ? ` · next meet-up ${formatDayShort(c.nextMeetup)}` : ''}`} />
            ))}
          </Card>
        </View>

        <View>
          <SectionHeader title="Alumni stories" />
          <Card padded={false} style={styles.list}>
            {stories.data?.map((s) => (
              <ListRow key={s.id} icon="sparkles-outline" title={s.headline} subtitle={`${s.name}, class of ${s.classOf}`} />
            ))}
          </Card>
        </View>

        <ListRow icon="calendar-outline" title="Alumni events" subtitle="Reunions, careers evenings and talks" onPress={() => router.push('/events')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter, gap: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
