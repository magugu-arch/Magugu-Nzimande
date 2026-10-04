import { View } from 'react-native';
import { formatMoney } from '@/core/domain/money';
import { formatDayShort, formatRelativeDay, formatTime } from '@/core/time/sast';
import { useGuardianAccount, useGuardianProfile } from '@/data/hooks';
import { Card, Header, QueryState, Screen, Text, colors, spacing } from '@/design';
import { useNow } from '@/features/system/useNow';

/**
 * The fee position a student has shared (consent scope 'fees'). Read-only,
 * never cached offline, and refused by the adapter without the grant.
 */
export default function GuardianFees() {
  const now = useNow();
  const profile = useGuardianProfile();
  const student = profile.data?.linkedStudents[0];
  const account = useGuardianAccount(student?.studentId);

  return (
    <Screen header={<Header title="Shared fees" fallbackHref="/guardian" />} testID="guardian-fees">
      <QueryState query={account} what="the shared fee account">
        {(a) => (
          <View style={{ gap: spacing.lg }}>
            <Card tone="navy">
              <Text variant="overline" color={colors.yellow}>
                {student?.givenName}’s fee account
              </Text>
              <Text variant="metric" color={colors.white}>
                {a.balance.cents > 0 ? formatMoney(a.balance) : 'Paid up'}
              </Text>
              {a.balance.cents > 0 && a.dueDate ? (
                <Text variant="bodyLarge" color={colors.white}>
                  Due {formatDayShort(a.dueDate)}
                </Text>
              ) : null}
              <Text variant="caption" color={colors.textOnDarkMuted} style={{ marginTop: spacing.sm }}>
                From Student Finance · as at {formatTime(a.asAt)} {formatRelativeDay(a.asAt, now).toLowerCase()}
              </Text>
            </Card>
            <Text variant="body" color={colors.textSecondary}>
              You can see this because {student?.givenName} shares fee information with you. Payments are made by the student, or with the student account reference at Student Finance.
            </Text>
          </View>
        )}
      </QueryState>
    </Screen>
  );
}
