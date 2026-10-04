import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { formatMoney } from '@/core/domain/money';
import type { Role } from '@/core/domain/models';
import {
  formatCountdown,
  formatDayLong,
  formatDayShort,
  formatRelativeDay,
  formatTime,
} from '@/core/time/sast';
import {
  useCampaigns,
  useEvents,
  useGuardianProfile,
  useGuardianUpdates,
  useJobs,
  useMentoring,
  useSupportRoutes,
  useTeachingWeek,
} from '@/data/hooks';
import {
  Button,
  Card,
  Icon,
  ListRow,
  Photo,
  Pill,
  ProgressBar,
  Row,
  SectionHeader,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
  type IconName,
} from '@/design';
import { asPhotoKey } from '@/content/photos';
import { useCan } from '@/features/access/access';
import { KIND_LABEL, isOnNow, nextClass } from '@/features/academics/timetable';
import { useNow } from '@/features/system/useNow';
import { ModuleError } from './StudentModules';

// ── Quick actions (max four — brief §5 "maximum six primary actions") ───────

interface QuickAction {
  label: string;
  icon: IconName;
  href: Href;
}

const QUICK: Record<Role, QuickAction[]> = {
  student: [
    { label: 'Timetable', icon: 'calendar', href: '/academics/timetable' },
    { label: 'Study space', icon: 'book', href: '/library?tab=spaces' },
    { label: 'Order food', icon: 'restaurant', href: '/dining' },
    { label: 'Safety', icon: 'shield-checkmark', href: '/safety' },
  ],
  staff: [
    { label: 'Teaching', icon: 'easel', href: '/academics/teaching' },
    { label: 'Directory', icon: 'people', href: '/directory' },
    { label: 'Study space', icon: 'book', href: '/library?tab=spaces' },
    { label: 'Safety', icon: 'shield-checkmark', href: '/safety' },
  ],
  parent: [
    { label: 'Key dates', icon: 'calendar', href: '/guardian' },
    { label: 'Fees', icon: 'wallet', href: '/guardian/fees' },
    { label: 'Campus map', icon: 'map', href: '/campus-map' },
    { label: 'Safety', icon: 'shield-checkmark', href: '/safety' },
  ],
  alumni: [
    { label: 'Mentoring', icon: 'chatbubbles', href: '/alumni/mentoring' },
    { label: 'Jobs', icon: 'briefcase', href: '/alumni/jobs' },
    { label: 'Give', icon: 'gift', href: '/alumni/giving' },
    { label: 'Events', icon: 'sparkles', href: '/events' },
  ],
};

export function QuickActionsModule({ role }: { role: Role }) {
  const router = useRouter();
  return (
    <View style={styles.quick} accessibilityRole="menu">
      {QUICK[role].map((a) => (
        <Touchable
          key={a.label}
          onPress={() => router.push(a.href)}
          accessibilityLabel={a.label}
          style={styles.quickItem}
          testID={`quick-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <View style={styles.quickIcon}>
            <Icon name={a.icon} size={22} color={colors.navy} />
          </View>
          <Text variant="captionStrong" align="center" numberOfLines={2}>
            {a.label}
          </Text>
        </Touchable>
      ))}
    </View>
  );
}

// ── Staff ───────────────────────────────────────────────────────────────────

export function TeachingModule() {
  const router = useRouter();
  const now = useNow();
  const teaching = useTeachingWeek();
  if (teaching.status === 'loading')
    return (
      <Card tone="navy">
        <Text color={colors.white}>Loading your teaching day…</Text>
      </Card>
    );
  if (!teaching.data)
    return <ModuleError what="Your teaching schedule" onRetry={teaching.refetch} />;
  const next = nextClass(teaching.data, now);
  if (!next) {
    return (
      <Card tone="navy" onPress={() => router.push('/academics/teaching')}>
        <Text variant="overline" color={colors.yellow}>
          Teaching
        </Text>
        <Text variant="title2" color={colors.white}>
          Nothing else to teach this week
        </Text>
      </Card>
    );
  }
  const when = isOnNow(next, now)
    ? 'Teaching now'
    : `Teaching ${formatRelativeDay(next.start, now).toLowerCase()} · ${formatCountdown(next.start, now)}`;
  return (
    <Card
      tone="navy"
      onPress={() => router.push('/academics/teaching')}
      accessibilityLabel={`${when}. ${next.moduleTitle} at ${formatTime(next.start)} in ${next.room.code}.`}
      testID="teaching-card"
    >
      <Text variant="overline" color={colors.yellow}>
        {when}
      </Text>
      <Text variant="title1" color={colors.white} style={{ marginTop: spacing.sm }}>
        {next.moduleTitle}
      </Text>
      <Text variant="body" color={colors.textOnDarkMuted}>
        {next.moduleCode} · {KIND_LABEL[next.kind]} · {formatTime(next.start)}–
        {formatTime(next.end)} · {next.room.code}
      </Text>
      {next.note ? (
        <View style={{ marginTop: spacing.md }}>
          <Pill label={next.note} tone="yellow" icon="swap-horizontal" />
        </View>
      ) : null}
      <Row gap={spacing.sm} style={{ marginTop: spacing.lg }} wrap>
        <Button
          label="Directions"
          icon="navigate"
          variant="accent"
          size="md"
          onPress={() => router.push(`/campus-map?to=${next.room.code}`)}
        />
        <Button
          label="My week"
          variant="onDark"
          size="md"
          onPress={() => router.push('/academics/teaching')}
        />
      </Row>
    </Card>
  );
}

// ── Parent / guardian ───────────────────────────────────────────────────────

const SCOPE_NAMES = {
  'key-dates': 'Key dates',
  fees: 'Fees',
  results: 'Results',
  residence: 'Residence',
  'wellbeing-alerts': 'Wellbeing alerts',
} as const;

export function LinkedStudentModule() {
  const router = useRouter();
  const profile = useGuardianProfile();
  if (profile.status === 'loading')
    return (
      <Card>
        <Text>Loading…</Text>
      </Card>
    );
  const student = profile.data?.linkedStudents[0];
  if (!student) return <ModuleError what="Your linked student" onRetry={profile.refetch} />;
  return (
    <Card
      padded={false}
      onPress={() => router.push('/guardian')}
      accessibilityLabel={`Supporting ${student.givenName}. Shared with you: ${student.sharing.map((s) => SCOPE_NAMES[s]).join(', ')}.`}
      testID="linked-student"
    >
      <Photo photo="parentConnection" size="md" rounded={false} style={styles.photo} decorative />
      <View style={styles.body}>
        <Text variant="overline" color={colors.textSecondary}>
          Supporting
        </Text>
        <Text variant="title2">{student.givenName}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {student.qualification} · final year
        </Text>
        <Row wrap gap={spacing.xs} style={{ marginTop: spacing.sm }}>
          {student.sharing.map((s) => (
            <Pill key={s} label={SCOPE_NAMES[s]} tone="success" icon="checkmark" />
          ))}
        </Row>
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
          {student.givenName} decides what you see. Nothing else is shared.
        </Text>
      </View>
    </Card>
  );
}

export function KeyDatesModule() {
  const router = useRouter();
  const profile = useGuardianProfile();
  const studentId = profile.data?.linkedStudents[0]?.studentId;
  const updates = useGuardianUpdates(studentId);
  const canSeeDates = useCan('guardian.key-dates');
  if (!canSeeDates) return null;
  const dates = updates.data?.filter((u) => u.scope === 'key-dates') ?? [];
  if (dates.length === 0) return null;
  return (
    <View>
      <SectionHeader
        title="Key dates"
        action="All updates"
        onAction={() => router.push('/guardian')}
      />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {dates.map((d) => (
          <ListRow
            key={d.id}
            icon="calendar-outline"
            title={d.title}
            subtitle={d.body}
            meta={`${formatDayLong(d.at)} · ${formatTime(d.at)}`}
          />
        ))}
      </Card>
    </View>
  );
}

export function FamilySupportModule() {
  const router = useRouter();
  const routes = useSupportRoutes();
  return (
    <View>
      <SectionHeader title="Support for families" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ListRow
          icon="shield-checkmark-outline"
          title="Safety on campus"
          subtitle="Emergency numbers and Campus Protection"
          onPress={() => router.push('/safety')}
        />
        {routes.data
          ?.filter((r) => r.id === 'route-helpdesk' || r.id === 'route-finance')
          .map((r) => (
            <ListRow
              key={r.id}
              icon="help-buoy-outline"
              title={r.name}
              subtitle={`${r.handles} · ${r.hours}`}
              onPress={r.href ? () => router.push(r.href as Href) : undefined}
            />
          ))}
        <ListRow
          icon="heart-outline"
          title="Wellbeing"
          subtitle="How students are supported"
          onPress={() => router.push('/wellbeing')}
        />
      </Card>
    </View>
  );
}

// ── Alumni ──────────────────────────────────────────────────────────────────

export function MentoringModule() {
  const router = useRouter();
  const mentoring = useMentoring();
  const open = mentoring.data?.filter((m) => m.status === 'open') ?? [];
  if (mentoring.status === 'loading') return null;
  if (mentoring.status === 'error')
    return <ModuleError what="Mentoring" onRetry={mentoring.refetch} />;
  const first = open[0];
  return (
    <Card
      padded={false}
      onPress={() => router.push('/alumni/mentoring')}
      accessibilityLabel={
        first ? `Mentoring opportunity: ${first.title}` : 'Mentoring. No open requests.'
      }
      testID="mentoring-card"
    >
      <Photo photo="alumniMentorship" size="md" rounded={false} style={styles.photo} decorative />
      <View style={styles.body}>
        <Row justify="space-between">
          <Text variant="overline" color={colors.textSecondary}>
            Mentoring
          </Text>
          {open.length ? <Pill label={`${open.length} new`} tone="yellow" /> : null}
        </Row>
        <Text variant="title3">{first ? first.title : 'No open requests right now'}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {first
            ? `${first.commitment}`
            : 'We’ll let you know when a student asks for someone like you.'}
        </Text>
      </View>
    </Card>
  );
}

export function GivingModule() {
  const router = useRouter();
  const campaigns = useCampaigns();
  const c = campaigns.data?.[0];
  if (!c) return null;
  const pct = c.raised.cents / c.goal.cents;
  return (
    <Card
      padded={false}
      onPress={() => router.push(`/alumni/give/${c.id}`)}
      accessibilityLabel={`${c.title}. ${Math.round(pct * 100)} percent funded. ${c.impact}`}
      testID="giving-card"
    >
      <Photo
        photo={asPhotoKey(c.photo, 'alumniGiving')}
        size="md"
        rounded={false}
        style={styles.photo}
        decorative
      />
      <View style={styles.body}>
        <Text variant="overline" color={colors.textSecondary}>
          Give back
        </Text>
        <Text variant="title3">{c.title}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {c.impact}
        </Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          <ProgressBar value={pct} tone="yellow" label={`${Math.round(pct * 100)}% funded`} />
          <Text variant="captionStrong">
            {formatMoney(c.raised, { showCents: false })} of{' '}
            {formatMoney(c.goal, { showCents: false })} · {c.donors.toLocaleString('en-ZA')} donors
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function AlumniEventsModule() {
  const router = useRouter();
  const events = useEvents();
  const list = events.data?.slice(0, 2) ?? [];
  if (list.length === 0) return null;
  return (
    <View>
      <SectionHeader
        title="Events for alumni"
        action="All"
        onAction={() => router.push('/events')}
      />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {list.map((e) => (
          <ListRow
            key={e.id}
            icon="sparkles-outline"
            title={e.title}
            subtitle={`${formatDayShort(e.start)} · ${formatTime(e.start)} · ${e.venue}`}
            onPress={() => router.push(`/events/${e.id}`)}
          />
        ))}
      </Card>
    </View>
  );
}

export function JobsModule() {
  const router = useRouter();
  const jobs = useJobs();
  const list = jobs.data?.slice(0, 3) ?? [];
  if (list.length === 0) return null;
  return (
    <View>
      <SectionHeader
        title="Careers"
        action="All jobs"
        onAction={() => router.push('/alumni/jobs')}
      />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {list.map((j) => (
          <ListRow
            key={j.id}
            icon="briefcase-outline"
            title={j.title}
            subtitle={`${j.organisation} · ${j.location}`}
            onPress={() => router.push('/alumni/jobs')}
          />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: spacing.sm },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { height: 160, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  body: { padding: spacing.lg, gap: spacing.xs },
});
