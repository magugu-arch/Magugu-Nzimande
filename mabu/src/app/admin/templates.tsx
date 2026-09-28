import { useMemo, useState } from 'react';
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
import { PREVIEW_SAFE_VARIABLES } from '@/domain/notifications/templates';
import type { NotificationChannel, NotificationTemplate } from '@/domain/notifications/types';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';

const CHANNELS: NotificationChannel[] = ['in-app', 'push', 'email', 'sms'];

/** §42 / §44: versioned, admin-managed templates. Lock-screen channels only accept safe variables. */
export default function AdminTemplates() {
  const q = useRpc('admin.templates');
  const [key, setKey] = useState<string | null>(null);
  const [channel, setChannel] = useState<NotificationChannel>('push');

  const keys = useMemo(() => [...new Set(q.data?.map((t) => t.key))].sort(), [q.data]);
  const current = q.data?.find((t) => t.key === key && t.channel === channel && t.active);
  const versions = q.data?.filter((t) => t.key === key && t.channel === channel) ?? [];

  return (
    <AdminScreen title="Templates" adminOnly>
      {!q.data ? (
        <LoadingBlock />
      ) : (
        <>
          <SectionTitle eyebrow="Message" title="Choose a template" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {keys.map((k) => (
              <Chip key={k} label={k} selected={key === k} onPress={() => setKey(k)} />
            ))}
          </View>
          {key ? (
            <>
              <SectionTitle eyebrow="Channel" title={key} />
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.xs,
                  marginBottom: spacing.lg,
                }}
              >
                {CHANNELS.map((c) => (
                  <Chip key={c} label={c} selected={channel === c} onPress={() => setChannel(c)} />
                ))}
              </View>
              <Editor
                key={`${key}:${channel}:${current?.version ?? 0}`}
                templateKey={key}
                channel={channel}
                current={current}
              />
              <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.md }}>
                {versions.length} version(s).{' '}
                {channel === 'sms' && !current ? 'Falls back to the push copy.' : ''}
              </Text>
            </>
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

function Editor({
  templateKey,
  channel,
  current,
}: {
  templateKey: string;
  channel: NotificationChannel;
  current?: NotificationTemplate;
}) {
  const [subject, setSubject] = useState(current?.subject ?? '');
  const [body, setBody] = useState(current?.body ?? '');
  const save = useRpcMutation('admin.template.save', ['admin.templates']);
  const lockScreen = channel === 'push' || channel === 'sms' || channel === 'whatsapp';
  return (
    <Card>
      <Text variant="caption" color="textMuted" style={{ marginBottom: spacing.md }}>
        {current
          ? `Live: version ${current.version}, by ${current.updatedBy}`
          : 'No template yet for this channel.'}
      </Text>
      <TextField label="Subject / title" value={subject} onChangeText={setSubject} />
      <TextField label="Body" value={body} onChangeText={setBody} multiline />
      {lockScreen ? (
        <Text variant="caption" color="warning" style={{ marginBottom: spacing.md }}>
          Shown on the lock screen: only{' '}
          {[...PREVIEW_SAFE_VARIABLES].map((v) => `{{${v}}}`).join(', ')} may be used.
        </Text>
      ) : null}
      {save.isError ? (
        <InlineNotice tone="danger" style={{ marginBottom: spacing.md }}>
          {errorMessage(save.error)}
        </InlineNotice>
      ) : null}
      {save.isSuccess ? (
        <InlineNotice
          tone="success"
          style={{ marginBottom: spacing.md }}
        >{`Published version ${save.data.version}.`}</InlineNotice>
      ) : null}
      <PremiumButton
        label="Publish new version"
        loading={save.isPending}
        onPress={() => save.mutate({ key: templateKey, channel, subject, body })}
      />
    </Card>
  );
}
