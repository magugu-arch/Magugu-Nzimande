import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { composeHome, type HomeModuleId } from '@/core/home/composeHome';
import { criticalNotice } from '@/core/notifications/priority';
import { formatDayLong, greetingFor, sastParts } from '@/core/time/sast';
import {
  useAccount,
  useAlumniProfile,
  useFunding,
  useNotificationsQuery,
  useOrders,
  useStudentProfile,
} from '@/data/hooks';
import {
  Avatar,
  BrandInline,
  Icon,
  Row,
  Screen,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
} from '@/design';
import {
  AlumniEventsModule,
  FamilySupportModule,
  GivingModule,
  JobsModule,
  KeyDatesModule,
  LinkedStudentModule,
  MentoringModule,
  QuickActionsModule,
  TeachingModule,
} from '@/features/home/RoleModules';
import {
  CriticalNoticeModule,
  DiscoverModule,
  GraduationModule,
  LunchModule,
  MoneyTile,
  NextClassModule,
  ShuttleTile,
  TodayModule,
} from '@/features/home/StudentModules';
import { useNow } from '@/features/system/useNow';
import { usePrefs } from '@/state/preferences';
import { useSession } from '@/state/session';

/** Modules that sit two-up when they are next to each other. */
const COMPACT: ReadonlySet<HomeModuleId> = new Set(['money', 'shuttle']);

/**
 * Home — the daily command centre (brief §5). It answers "what matters to me
 * right now?": greeting and date, the next class, one critical notice, the
 * money and transport status when relevant, and a few quick actions.
 */
export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = useNow();
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const prefs = usePrefs(user?.id);
  const isStudent = role === 'student';

  const notifications = useNotificationsQuery();
  const account = useAccount(isStudent);
  const funding = useFunding(isStudent);
  const profile = useStudentProfile(isStudent);
  const orders = useOrders(isStudent || role === 'staff');
  const alumni = useAlumniProfile(role === 'alumni');

  if (!user || !role) return null;

  const notice = notifications.data ? criticalNotice(notifications.data, now) : null;
  const p = sastParts(now);
  const modules = composeHome(
    {
      role,
      minutesOfDay: p.hours * 60 + p.minutes,
      hasCriticalNotice: !!notice,
      moneyNeedsAttention:
        isStudent &&
        (account.status !== 'success' || (account.data?.balance.cents ?? 0) > 0 || funding.data?.status === 'delayed'),
      graduationEligible: isStudent && !!profile.data?.graduation.eligible,
      hasActiveOrder: !!orders.data?.some((o) => ['placed', 'preparing', 'ready'].includes(o.status)),
    },
    prefs.homeLayouts[role],
  );

  const render = (id: HomeModuleId): ReactNode => {
    switch (id) {
      case 'next-class':
        return <NextClassModule />;
      case 'critical-notice':
        return notice ? <CriticalNoticeModule notice={notice} /> : null;
      case 'money':
        return <MoneyTile />;
      case 'shuttle':
        return <ShuttleTile />;
      case 'quick-actions':
        return <QuickActionsModule role={role} />;
      case 'lunch':
        return <LunchModule />;
      case 'today':
        return <TodayModule />;
      case 'graduation':
        return <GraduationModule />;
      case 'discover':
        return <DiscoverModule />;
      case 'teaching':
        return <TeachingModule />;
      case 'linked-student':
        return <LinkedStudentModule />;
      case 'key-dates':
        return <KeyDatesModule />;
      case 'support':
        return <FamilySupportModule />;
      case 'mentoring':
        return <MentoringModule />;
      case 'giving':
        return <GivingModule />;
      case 'alumni-events':
        return <AlumniEventsModule />;
      case 'jobs':
        return <JobsModule />;
    }
  };

  // Pair consecutive compact modules into one row.
  const rows: HomeModuleId[][] = [];
  for (const id of modules) {
    const last = rows[rows.length - 1];
    if (last && last.length === 1 && COMPACT.has(id) && COMPACT.has(last[0]!)) last.push(id);
    else rows.push([id]);
  }

  const initials = `${user.givenName[0] ?? ''}${user.familyName[0] ?? ''}`;
  // Graduated this year: the same person, greeted into their new community.
  const isNewAlumnus = role === 'alumni' && alumni.data?.graduationYear === p.year;

  return (
    <Screen
      testID="home"
      onRefresh={() => void queryClient.invalidateQueries()}
      refreshing={false}
    >
      <Row justify="space-between" style={styles.topBar}>
        <BrandInline />
        <Touchable onPress={() => router.push('/profile')} accessibilityLabel="Your profile" style={styles.avatarHit}>
          <Avatar initials={initials} size={40} tone={role === 'alumni' ? 'navy' : 'yellow'} />
        </Touchable>
      </Row>

      <View style={styles.greeting}>
        <Text variant="overline" color={colors.textSecondary}>
          {formatDayLong(now)}
        </Text>
        <Text variant="title1" accessibilityRole="header" testID="home-greeting">
          {isNewAlumnus ? `Welcome to the alumni community, ${user.givenName}` : `${greetingFor(now)}, ${user.givenName}`}
        </Text>
      </View>

      <Touchable
        onPress={() => router.push('/search')}
        accessibilityRole="search"
        accessibilityLabel="Search or ask NMU ONE"
        accessibilityHint="Find people, places, services and answers"
        style={styles.search}
        testID="home-search"
      >
        <Icon name="search" size={20} color={colors.textSecondary} />
        <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
          Search or ask NMU ONE
        </Text>
        <Icon name="sparkles" size={18} color={colors.navy2} />
      </Touchable>

      <View style={styles.modules}>
        {rows.map((row) =>
          row.length === 2 ? (
            <View key={row.join('+')} style={styles.pair}>
              {row.map((id) => (
                <Fragment key={id}>{render(id)}</Fragment>
              ))}
            </View>
          ) : (
            <Fragment key={row[0]}>{render(row[0]!)}</Fragment>
          ),
        )}
      </View>

      <Touchable onPress={() => router.push('/settings/home')} accessibilityRole="link" accessibilityLabel="Edit Home" style={styles.edit} testID="edit-home">
        <Icon name="options-outline" size={18} color={colors.navy2} />
        <Text variant="captionStrong" color={colors.navy2}>
          Edit Home
        </Text>
      </Touchable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { marginBottom: spacing.lg },
  avatarHit: { alignItems: 'center', justifyContent: 'center' },
  greeting: { gap: spacing.xs, marginBottom: spacing.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  modules: { gap: spacing.lg },
  pair: { flexDirection: 'row', gap: spacing.md },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
});
