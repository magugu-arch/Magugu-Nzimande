import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen, NumberField, Row } from '@/components/admin/Admin';
import {
  Chip,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  SectionTitle,
  Text,
  TextField,
  ToggleRow,
} from '@/components/ui';
import type { BookingPolicy } from '@/domain/reservations/policy';
import { formatCalendarDate, formatRand } from '@/domain/shared/format';
import { isValidDate } from '@/domain/shared/time';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';

/** §30 / §44: booking rules as data — table durations, cut-offs, deposits, closures, reminders, policy copy. */
export default function AdminPolicy() {
  const q = useRpc('admin.policy');
  if (!q.data) {
    return (
      <AdminScreen title="Booking policy" adminOnly>
        <LoadingBlock />
      </AdminScreen>
    );
  }
  return <PolicyForm key={q.data.version} policy={q.data} />;
}

function PolicyForm({ policy }: { policy: BookingPolicy }) {
  const [p, setP] = useState(policy);
  const [closed, setClosed] = useState('');
  const save = useRpcMutation('admin.policy.update', [
    'admin.policy',
    'booking.policy',
    'booking.search',
    'booking.dayStates',
  ]);
  const set = (patch: Partial<BookingPolicy>) => setP({ ...p, ...patch });

  return (
    <AdminScreen
      title="Booking policy"
      adminOnly
      footer={
        <PremiumButton
          label={`Save · version ${policy.version + 1}`}
          loading={save.isPending}
          onPress={() => {
            const { id: _id, version: _v, updatedAt: _u, ...patch } = p;
            save.mutate(patch);
          }}
        />
      }
    >
      <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.md }}>
        Version {policy.version}. Changes apply to new searches immediately — no app release needed.
      </Text>
      <SectionTitle eyebrow="Parties" title="Size & duration" />
      <Row>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Min party"
            value={p.minPartySize}
            onChange={(v) => set({ minPartySize: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Max party"
            value={p.maxPartySize}
            onChange={(v) => set({ maxPartySize: v })}
            hint="Larger → private functions"
          />
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Table minutes"
            value={p.tableDurationMinutes}
            onChange={(v) => set({ tableDurationMinutes: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label={`From ${p.largeTableFromPartySize} guests`}
            value={p.largeTableDurationMinutes}
            onChange={(v) => set({ largeTableDurationMinutes: v })}
          />
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Covers per seating"
            value={p.coversPerSlot}
            onChange={(v) => set({ coversPerSlot: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Slot interval (min)"
            value={p.slotIntervalMinutes}
            onChange={(v) => set({ slotIntervalMinutes: v })}
          />
        </View>
      </Row>

      <SectionTitle eyebrow="Timing" title="Windows & cut-offs" />
      <Row>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Lead time (min)"
            value={p.leadTimeMinutes}
            onChange={(v) => set({ leadTimeMinutes: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Book ahead (days)"
            value={p.maxAdvanceDays}
            onChange={(v) => set({ maxAdvanceDays: v })}
          />
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Late cancel (hours)"
            value={p.cancellationCutoffHours}
            onChange={(v) => set({ cancellationCutoffHours: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Guest changes (hours)"
            value={p.amendCutoffHours}
            onChange={(v) => set({ amendCutoffHours: v })}
          />
        </View>
      </Row>
      <TextField
        label="Reminders (hours before, comma-separated)"
        value={p.reminderHoursBefore.join(', ')}
        onChangeText={(t) =>
          set({
            reminderHoursBefore: t
              .split(',')
              .map((x) => Number(x.trim()))
              .filter((n) => Number.isFinite(n) && n > 0),
          })
        }
      />

      <SectionTitle eyebrow="Deposits" title="Securing larger tables" />
      <ToggleRow
        label="Require a deposit"
        description="Takes effect only while the deposit feature flag is on."
        value={p.deposit.enabled}
        onChange={(enabled) => set({ deposit: { ...p.deposit, enabled } })}
      />
      <Row>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Per guest (R)"
            value={p.deposit.perPersonCents / 100}
            onChange={(v) => set({ deposit: { ...p.deposit, perPersonCents: v * 100 } })}
            hint={formatRand(p.deposit.perPersonCents)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="From party of"
            value={p.deposit.appliesFromPartySize}
            onChange={(v) => set({ deposit: { ...p.deposit, appliesFromPartySize: v } })}
          />
        </View>
      </Row>

      <SectionTitle eyebrow="Closures" title="Closed dates" />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        {p.closedDates.map((d) => (
          <Chip
            key={d}
            label={`${formatCalendarDate(d)}  ✕`}
            selected
            onPress={() => set({ closedDates: p.closedDates.filter((x) => x !== d) })}
          />
        ))}
        {!p.closedDates.length ? (
          <Text variant="bodySmall" color="textMuted">
            None.
          </Text>
        ) : null}
      </View>
      <Row>
        <View style={{ flex: 1 }}>
          <TextField
            label="Add a date (YYYY-MM-DD)"
            value={closed}
            onChangeText={setClosed}
            autoCapitalize="none"
          />
        </View>
      </Row>
      <PremiumButton
        label="Add closure"
        variant="secondary"
        compact
        disabled={!isValidDate(closed)}
        onPress={() => {
          set({ closedDates: [...new Set([...p.closedDates, closed])].sort() });
          setClosed('');
        }}
      />

      <SectionTitle eyebrow="Guest-facing" title="Policy copy" />
      <TextField
        label="Cancellation policy"
        value={p.cancellationPolicyText}
        onChangeText={(cancellationPolicyText) => set({ cancellationPolicyText })}
        multiline
      />
      <TextField
        label="No-show policy"
        value={p.noShowPolicyText}
        onChangeText={(noShowPolicyText) => set({ noShowPolicyText })}
        multiline
      />

      {save.isError ? <InlineNotice tone="danger">{errorMessage(save.error)}</InlineNotice> : null}
      {save.isSuccess ? (
        <InlineNotice tone="success">{`Saved as version ${save.data.version}.`}</InlineNotice>
      ) : null}
    </AdminScreen>
  );
}
