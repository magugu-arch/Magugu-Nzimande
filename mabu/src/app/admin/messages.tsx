import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen } from '@/components/admin/Admin';
import { Card, LoadingBlock, PremiumButton, Segmented, Text } from '@/components/ui';
import { formatDateShort, formatTime } from '@/domain/shared/format';
import { config } from '@/services/config';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/**
 * §44 "Persist every … notification delivery attempt": every message, each
 * channel's attempts and errors, and — in the mock — what the gateways were
 * handed.
 */
export default function AdminMessages() {
  const role = useSession((s) => s.actor?.role);
  const q = useRpc('admin.messages');
  const [tab, setTab] = useState<'log' | 'outbox'>('log');
  const fail = useRpcMutation('admin.simulateFailure');
  const run = useRpcMutation('admin.jobs.run', ['admin.messages']);

  return (
    <AdminScreen title="Message log">
      <View style={{ marginTop: spacing.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'log', label: 'Deliveries' },
            { value: 'outbox', label: 'Outbox' },
          ]}
        />
      </View>
      {!q.data ? (
        <LoadingBlock />
      ) : tab === 'log' ? (
        q.data.messages.map((m) => (
          <Card key={m.id} style={{ marginTop: spacing.sm, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Text variant="bodySmall" style={{ flex: 1 }}>
                {m.templateKey}
              </Text>
              <Text
                variant="caption"
                color={
                  m.status === 'sent'
                    ? 'success'
                    : m.status === 'failed'
                      ? 'danger'
                      : m.status === 'suppressed'
                        ? 'warning'
                        : 'textMuted'
                }
              >
                {m.status}
              </Text>
            </View>
            <Text variant="caption" color="textSubtle">
              {m.createdAt ? `${formatDateShort(m.createdAt)} ${formatTime(m.createdAt)}` : ''}
              {m.scheduledFor
                ? ` · for ${formatDateShort(m.scheduledFor)} ${formatTime(m.scheduledFor)}`
                : ''}
              {m.suppressedReason ? ` · ${m.suppressedReason}` : ''}
            </Text>
            {m.deliveries.map((d) => (
              <Text
                key={d.id}
                variant="caption"
                style={{ color: d.status === 'failed' ? colors.danger : colors.textMuted }}
              >
                {d.channel}: {d.status} · {d.attempts} attempt(s)
                {d.lastError ? ` · ${d.lastError}` : ''}
                {d.nextAttemptAt && d.status === 'pending'
                  ? ` · retry ${formatTime(d.nextAttemptAt)}`
                  : ''}
              </Text>
            ))}
          </Card>
        ))
      ) : (
        q.data.outbox.map((o, i) => (
          <Card key={`${o.at}${i}`} style={{ marginTop: spacing.sm, gap: 4 }}>
            <Text variant="caption" color="accent">
              {o.channel} → {o.to}
            </Text>
            <Text variant="title">{o.subject}</Text>
            <Text variant="bodySmall" color="textMuted">
              {o.body}
            </Text>
          </Card>
        ))
      )}
      <PremiumButton
        label="Process due & retries"
        variant="secondary"
        style={{ marginTop: spacing.xl }}
        loading={run.isPending}
        onPress={() => run.mutate(undefined)}
      />
      {config.useMockApi && role === 'admin' ? (
        <PremiumButton
          label="Simulate next 2 push failures"
          variant="ghost"
          onPress={() => fail.mutate({ channel: 'push', count: 2 })}
        />
      ) : null}
    </AdminScreen>
  );
}
