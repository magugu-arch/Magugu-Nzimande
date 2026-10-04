import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { config } from '@/core/config';
import { isDemoData } from '@/core/adapters/registry';
import type { Role } from '@/core/domain/models';
import { formatDayLong } from '@/core/time/sast';
import { useAlumniProfile, useStaffProfile, useStudentProfile } from '@/data/hooks';
import { offlineCache } from '@/data/offlineCache';
import {
  Avatar,
  Button,
  Card,
  Chip,
  ListRow,
  Pill,
  Row,
  Screen,
  SectionHeader,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { useSession } from '@/state/session';

const ROLE_NAMES: Record<Role, string> = {
  student: 'Student',
  staff: 'Staff',
  parent: 'Parent / guardian',
  alumni: 'Alumni',
};

/**
 * Profile and identity (brief §15): who NMU ONE thinks you are, which role
 * you are acting in, and every control over your data in one place.
 */
export default function Profile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const switchRole = useSession((s) => s.switchRole);
  const signOut = useSession((s) => s.signOut);
  const canGraduate = useCan('lifecycle.graduate');

  const student = useStudentProfile(role === 'student');
  const staff = useStaffProfile(role === 'staff');
  const alumni = useAlumniProfile(role === 'alumni');

  if (!user || !role) return null;

  const detail =
    role === 'student' && student.data
      ? [
          `Student no. ${student.data.studentNumber}`,
          student.data.qualification,
          student.data.faculty,
        ]
      : role === 'staff' && staff.data
        ? [staff.data.title, staff.data.department, `Office ${staff.data.office.code}`]
        : role === 'alumni' && alumni.data
          ? [
              `${alumni.data.qualification}, ${alumni.data.graduationYear}`,
              alumni.data.chapter ?? '',
            ]
          : role === 'parent'
            ? ['Linked to one student']
            : [];

  const doSignOut = async () => {
    const id = user.id;
    await signOut();
    queryClient.clear();
    await offlineCache.clearFor(id);
    router.replace('/sign-in');
  };

  return (
    <Screen testID="profile">
      <Text variant="title1" accessibilityRole="header" style={{ marginBottom: spacing.lg }}>
        Profile
      </Text>

      <Card tone="navy" testID="identity-card">
        <Row gap={spacing.lg} align="flex-start">
          <Avatar initials={`${user.givenName[0]}${user.familyName[0]}`} size={64} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="title2" color={colors.white}>
              {user.givenName} {user.familyName}
            </Text>
            <Pill label={ROLE_NAMES[role]} tone="yellow" />
            {detail.filter(Boolean).map((d) => (
              <Text key={d} variant="caption" color={colors.textOnDarkMuted}>
                {d}
              </Text>
            ))}
          </View>
        </Row>
        <Text variant="caption" color={colors.textOnDarkMuted} style={{ marginTop: spacing.lg }}>
          Signed in with NMU Single Sign-On · {user.email}
        </Text>
      </Card>

      {user.roles.length > 1 ? (
        <View style={styles.section}>
          <SectionHeader title="You are using NMU ONE as" />
          <Row gap={spacing.sm} wrap>
            {user.roles.map((r) => (
              <Chip
                key={r}
                label={ROLE_NAMES[r]}
                selected={r === role}
                onPress={() => switchRole(r)}
                testID={`role-${r}`}
              />
            ))}
          </Row>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
            One identity, more than one role. Home, services and notifications follow the role you
            choose.
          </Text>
        </View>
      ) : null}

      {canGraduate && student.data?.graduation.eligible && student.data.graduation.ceremony ? (
        <View style={styles.section}>
          <SectionHeader title="Your journey" />
          <Card
            onPress={() => router.push('/graduation')}
            accessibilityLabel={`Graduation on ${formatDayLong(student.data.graduation.ceremony)}. See what changes.`}
            testID="profile-graduation"
          >
            <Text variant="overline" color={colors.textSecondary}>
              Graduation · {formatDayLong(student.data.graduation.ceremony)}
            </Text>
            <Text variant="title3">Student → Graduate → Alumni</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Your NMU ONE account comes with you. See what changes on the day →
            </Text>
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Identity" />
        <Card padded={false} style={styles.list}>
          <ListRow
            icon="id-card-outline"
            title="Digital student ID"
            subtitle="Coming once NMU approves it"
            trailing={<Pill label="Not yet available" />}
            onPress={() => router.push('/settings/digital-id')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Settings" />
        <Card padded={false} style={styles.list}>
          <ListRow
            icon="lock-closed-outline"
            title="Privacy & sharing"
            subtitle="Consents, family sharing and your activity log"
            onPress={() => router.push('/settings/privacy')}
            testID="settings-privacy"
          />
          <ListRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Categories and quiet hours"
            onPress={() => router.push('/settings/notifications')}
          />
          <ListRow
            icon="grid-outline"
            title="Edit Home"
            subtitle="Reorder or hide what you see first"
            onPress={() => router.push('/settings/home')}
          />
          <ListRow
            icon="accessibility-outline"
            title="Accessibility"
            subtitle="Text size, motion and screen readers"
            onPress={() => router.push('/settings/accessibility')}
          />
          <ListRow
            icon="information-circle-outline"
            title="About NMU ONE"
            subtitle={
              isDemoData() ? 'Demo build · synthetic data' : `Live build · ${config.dataMode}`
            }
            onPress={() => router.push('/settings/about')}
          />
        </Card>
      </View>

      <Button
        label="Sign out"
        variant="secondary"
        icon="log-out-outline"
        onPress={doSignOut}
        fullWidth
        testID="sign-out"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
