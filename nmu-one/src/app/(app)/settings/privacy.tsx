import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import type { ConsentPurpose, SharingScope } from '@/core/domain/models';
import { clock } from '@/core/time/clock';
import { formatAgo } from '@/core/time/sast';
import { useMyGuardians } from '@/data/hooks';
import {
  Card,
  Divider,
  Header,
  ListRow,
  Notice,
  QueryState,
  Screen,
  SectionHeader,
  Text,
  Toggle,
  colors,
  spacing,
} from '@/design';
import { recordAudit, useGovernance } from '@/state/governance';
import { useSession } from '@/state/session';
import { showToast } from '@/state/toasts';

const SCOPES: { scope: SharingScope; label: string; description: string }[] = [
  {
    scope: 'key-dates',
    label: 'Key dates',
    description: 'Term dates, exams and your graduation ceremony',
  },
  { scope: 'fees', label: 'Fees', description: 'Your balance and due dates — not your statement' },
  { scope: 'results', label: 'Results', description: 'Published marks' },
  { scope: 'residence', label: 'Residence', description: 'Your room and residence notices' },
];

const PURPOSE_LABEL = (p: ConsentPurpose) =>
  p === 'location-sharing'
    ? 'Location sharing with Campus Protection'
    : p === 'push-notifications'
      ? 'Push notifications'
      : `Family sharing: ${p.replace('guardian-sharing:', '').replace('-', ' ')}`;

/**
 * Privacy (brief §24): consent recording, purpose controls and an audit log
 * the person can read. Family sharing is controlled here, by the student, and
 * by no one else (brief §3).
 */
export default function Privacy() {
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const guardians = useMyGuardians();
  const consents = useGovernance((s) => s.consents);
  const audit = useGovernance((s) => s.audit);
  const recordConsent = useGovernance((s) => s.recordConsent);
  const [saving, setSaving] = useState<string | null>(null);

  const setScope = async (
    guardianId: string,
    current: SharingScope[],
    scope: SharingScope,
    on: boolean,
  ) => {
    setSaving(scope);
    try {
      const next = on ? [...current, scope] : current.filter((s) => s !== scope);
      await providers.guardian.setGuardianSharing(guardianId, next);
      recordConsent(`guardian-sharing:${scope}`, on);
      if (user)
        recordAudit(
          'consent.change',
          user.id,
          `${on ? 'Shared' : 'Stopped sharing'} ${scope} with family`,
        );
      void queryClient.invalidateQueries({ queryKey: ['my-guardians', user?.id] });
      showToast({ title: on ? 'Shared' : 'No longer shared', tone: 'success' });
    } catch {
      showToast({ title: 'That didn’t save — nothing changed', tone: 'info' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen
      header={
        <Header
          title="Privacy"
          largeTitle="Privacy & sharing"
          eyebrow="Settings"
          fallbackHref="/profile"
        />
      }
      testID="privacy"
    >
      {role === 'student' ? (
        <View style={styles.section}>
          <SectionHeader title="Sharing with family" />
          <QueryState query={guardians} what="your linked family">
            {(list) =>
              list.length === 0 ? (
                <Card tone="sunken">
                  <Text variant="body" color={colors.textSecondary}>
                    No parent or guardian is linked to your account.
                  </Text>
                </Card>
              ) : (
                list.map((g) => (
                  <Card key={g.guardianId} testID={`guardian-${g.guardianId}`}>
                    <Text variant="title3">{g.name}</Text>
                    <Text
                      variant="caption"
                      color={colors.textSecondary}
                      style={{ marginBottom: spacing.sm }}
                    >
                      Your {g.relationship}. They see only what you switch on.
                    </Text>
                    {SCOPES.map((s, i) => (
                      <View key={s.scope}>
                        {i > 0 ? <Divider /> : null}
                        <Toggle
                          label={s.label}
                          description={s.description}
                          value={g.sharing.includes(s.scope)}
                          disabled={saving !== null}
                          onChange={(on) => setScope(g.guardianId, g.sharing, s.scope, on)}
                          testID={`share-${s.scope}`}
                        />
                      </View>
                    ))}
                  </Card>
                ))
              )
            }
          </QueryState>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Your consents" />
        {consents.length === 0 ? (
          <Card tone="sunken">
            <Text variant="body" color={colors.textSecondary}>
              You haven’t made any consent choices this session. Choices you make — like sharing
              your location — are recorded here.
            </Text>
          </Card>
        ) : (
          <Card padded={false} style={styles.list}>
            {consents.map((c) => (
              <ListRow
                key={c.id}
                icon={c.granted ? 'checkmark-circle-outline' : 'close-circle-outline'}
                iconTone={c.granted ? 'success' : 'sunken'}
                title={PURPOSE_LABEL(c.purpose)}
                subtitle={`${c.granted ? 'Given' : 'Withdrawn'} ${formatAgo(c.at, clock.now()).toLowerCase()} · notice ${c.noticeVersion}`}
              />
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Activity on your account" />
        {audit.length === 0 ? (
          <Card tone="sunken">
            <Text variant="body" color={colors.textSecondary}>
              Nothing recorded yet.
            </Text>
          </Card>
        ) : (
          <Card padded={false} style={styles.list} testID="audit-log">
            {audit.slice(0, 20).map((a) => (
              <ListRow
                key={a.id}
                icon="document-text-outline"
                title={a.detail}
                subtitle={`${a.type} · ${formatAgo(a.at, clock.now()).toLowerCase()}`}
              />
            ))}
          </Card>
        )}
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
          Sign-ins, role changes, consent choices and access to sensitive information are logged.
          The university keeps the authoritative record.
        </Text>
      </View>

      <View style={styles.section}>
        <Notice
          tone="neutral"
          icon="shield-checkmark-outline"
          title="How NMU ONE handles your data"
          body="Sign-in tokens are kept in your phone’s secure storage. Fees, results and wellbeing information are never saved for offline use. Location is used only when you ask, and only for as long as you choose."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg },
});
