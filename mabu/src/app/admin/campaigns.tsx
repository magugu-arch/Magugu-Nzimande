import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen } from '@/components/admin/Admin';
import {
  Card,
  Chip,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  SectionTitle,
  Text,
  TextField,
} from '@/components/ui';
import { formatDateShort, formatTime } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';

const WHEN = [
  { label: 'Now', minutes: 0 },
  { label: 'In 1 hour', minutes: 60 },
  { label: 'Tomorrow 10:00', minutes: -1 },
];

/** §44 campaign scheduling. Sends only to guests with valid marketing consent (§42). */
export default function AdminCampaigns() {
  const q = useRpc('admin.campaigns');
  const schedule = useRpcMutation('admin.campaign.schedule', ['admin.campaigns']);
  const cancel = useRpcMutation('admin.campaign.cancel', ['admin.campaigns']);
  const run = useRpcMutation('admin.jobs.run', ['admin.campaigns']);
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [when, setWhen] = useState(0);

  const scheduledFor = () => {
    const now = new Date();
    if (WHEN[when]!.minutes >= 0)
      return new Date(now.getTime() + WHEN[when]!.minutes * 60_000).toISOString();
    const t = new Date(now.getTime() + 86_400_000 + 2 * 3_600_000);
    return `${t.toISOString().slice(0, 10)}T10:00:00+02:00`;
  };

  return (
    <AdminScreen title="Campaigns" adminOnly>
      {!q.data ? (
        <LoadingBlock />
      ) : (
        <>
          {!q.data.marketingEnabled ? (
            <InlineNotice tone="warning" style={{ marginTop: spacing.lg }}>
              Marketing notifications are switched off (MABU_MARKETING_NOTIFICATIONS_ENABLED=false).
              Campaigns can be scheduled, but every message will be suppressed until the flag is on.
            </InlineNotice>
          ) : null}
          <Text variant="bodySmall" color="textMuted" style={{ marginTop: spacing.lg }}>
            {q.data.consenting} guest(s) have opted in to news and promotions.
          </Text>

          <SectionTitle eyebrow="New" title="Schedule a campaign" />
          <TextField label="Internal name" value={name} onChangeText={setName} />
          <TextField
            label="Headline"
            value={headline}
            onChangeText={setHeadline}
            hint="Shown as the push title — keep it short."
          />
          <TextField label="Body (email & in-app)" value={body} onChangeText={setBody} multiline />
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginBottom: spacing.lg,
              flexWrap: 'wrap',
            }}
          >
            {WHEN.map((w, i) => (
              <Chip
                key={w.label}
                label={w.label}
                selected={when === i}
                onPress={() => setWhen(i)}
              />
            ))}
          </View>
          {schedule.isError ? (
            <InlineNotice tone="danger" style={{ marginBottom: spacing.md }}>
              {errorMessage(schedule.error)}
            </InlineNotice>
          ) : null}
          <PremiumButton
            label="Schedule"
            loading={schedule.isPending}
            onPress={() =>
              schedule.mutate(
                { name, headline, body, scheduledFor: scheduledFor() },
                {
                  onSuccess: () => {
                    setName('');
                    setHeadline('');
                    setBody('');
                  },
                },
              )
            }
          />

          <SectionTitle eyebrow="History" title="Campaigns" />
          {q.data.campaigns.map((c) => (
            <Card key={c.id} style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
              <Text variant="title">{c.name}</Text>
              <Text variant="caption" color="textMuted">
                {c.status} · {formatDateShort(c.scheduledFor)} {formatTime(c.scheduledFor)}
                {c.status === 'sent'
                  ? ` · ${c.recipients} sent, ${c.blockedNoConsent} held back (no consent)`
                  : ''}
              </Text>
              {c.status === 'scheduled' ? (
                <PremiumButton
                  label="Cancel"
                  variant="ghost"
                  compact
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => cancel.mutate({ id: c.id })}
                />
              ) : null}
            </Card>
          ))}
          <PremiumButton
            label="Send what is due now"
            variant="secondary"
            style={{ marginTop: spacing.lg }}
            loading={run.isPending}
            onPress={() => run.mutate(undefined)}
          />
        </>
      )}
    </AdminScreen>
  );
}
