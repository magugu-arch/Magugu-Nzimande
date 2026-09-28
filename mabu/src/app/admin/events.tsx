import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen, NumberField } from '@/components/admin/Admin';
import { Card, InlineNotice, LoadingBlock, PremiumButton, Text, ToggleRow } from '@/components/ui';
import type { Experience } from '@/domain/experiences/types';
import { formatDateShort, formatRand, formatTime } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

/** §18 Events: capacity, pricing, publishing, and checking guests in (which earns their points). */
export default function AdminEvents() {
  const q = useRpc('admin.events');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <AdminScreen title="Events">
      {!q.data ? (
        <LoadingBlock />
      ) : (
        q.data.map((e) => (
          <Card key={e.id} style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Text variant="title">{e.title}</Text>
            <Text variant="caption" color="textMuted">
              {formatDateShort(e.startsAt)} {formatTime(e.startsAt)} · {e.seatsBooked}/{e.capacity}{' '}
              booked · {e.priceCents === null ? 'price on request' : formatRand(e.priceCents)} ·{' '}
              {e.published ? 'published' : 'draft'}
            </Text>
            <PremiumButton
              label={open === e.id ? 'Close' : 'Manage'}
              variant="secondary"
              compact
              onPress={() => setOpen(open === e.id ? null : e.id)}
            />
            {open === e.id ? <EventManager event={e} /> : null}
          </Card>
        ))
      )}
    </AdminScreen>
  );
}

function EventManager({ event }: { event: Experience }) {
  const role = useSession((s) => s.actor?.role);
  const [e, setE] = useState(event);
  const save = useRpcMutation('admin.events.save', [
    'admin.events',
    'events.list',
    'events.get',
    'admin.dashboard',
  ]);
  const bookings = useRpc('admin.events.bookings', { eventId: event.id });
  const attend = useRpcMutation('admin.events.attend', ['admin.events.bookings']);
  return (
    <View style={{ gap: spacing.sm }}>
      {role === 'admin' ? (
        <>
          <ToggleRow
            label="Published"
            value={e.published}
            onChange={(published) => setE({ ...e, published })}
          />
          <ToggleRow
            label="Waitlist when full"
            value={e.waitlistEnabled}
            onChange={(waitlistEnabled) => setE({ ...e, waitlistEnabled })}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Capacity"
                value={e.capacity}
                onChange={(capacity) => setE({ ...e, capacity })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Price (R)"
                value={(e.priceCents ?? 0) / 100}
                onChange={(v) => setE({ ...e, priceCents: v * 100 })}
              />
            </View>
          </View>
          <PremiumButton
            label="Save event"
            compact
            loading={save.isPending}
            onPress={() => save.mutate(e)}
          />
          {save.isError ? (
            <InlineNotice tone="danger">{errorMessage(save.error)}</InlineNotice>
          ) : null}
        </>
      ) : null}
      <Text variant="eyebrow" color="accent" style={{ marginTop: spacing.md }}>
        Guest list
      </Text>
      {bookings.data?.length ? (
        bookings.data.map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="bodySmall" style={{ flex: 1 }}>
              {b.guestName} · {b.seats} · {b.status}
            </Text>
            {b.status === 'confirmed' ? (
              <PremiumButton
                label="Check in"
                variant="ghost"
                compact
                onPress={() => attend.mutate({ bookingId: b.id })}
              />
            ) : null}
          </View>
        ))
      ) : (
        <Text variant="caption" color="textMuted">
          No app bookings yet.
        </Text>
      )}
      {attend.isError ? (
        <InlineNotice tone="danger">{errorMessage(attend.error)}</InlineNotice>
      ) : null}
    </View>
  );
}
