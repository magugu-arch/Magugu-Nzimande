import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { AdminScreen } from '@/components/admin/Admin';
import {
  EmptyState,
  IconButton,
  LoadingBlock,
  PremiumButton,
  Text,
  TextField,
} from '@/components/ui';
import { STATUS_LABEL } from '@/domain/reservations/status';
import { formatCalendarDate, formatDateShort, formatTime } from '@/domain/shared/format';
import { addDays, venueDate } from '@/domain/shared/time';
import { useRpc, useRpcMutation } from '@/services/queries';
import { colors, spacing } from '@/theme';

/** §18 Reservations: view, search and manage the day's book. */
export default function AdminReservations() {
  const [date, setDate] = useState(venueDate(new Date()));
  const [term, setTerm] = useState('');
  const day = useRpc('admin.reservations', { date });
  const search = useRpc('admin.reservationSearch', { term }, { enabled: term.trim().length >= 2 });
  const match = useRpcMutation('admin.waitlist.match', ['admin.reservations', 'admin.dashboard']);
  const list = term.trim().length >= 2 ? search.data : day.data;

  return (
    <AdminScreen title="Reservations">
      <View style={{ marginTop: spacing.md }}>
        <TextField
          label="Search"
          placeholder="Reference, name, email or phone"
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
        />
      </View>
      {term.trim().length < 2 ? (
        <View style={styles.dayNav}>
          <IconButton
            icon="chevron-left"
            label="Previous day"
            onPress={() => setDate(addDays(date, -1))}
          />
          <Text variant="title" style={{ flex: 1, textAlign: 'center' }}>
            {formatCalendarDate(date)}
          </Text>
          <IconButton
            icon="chevron-right"
            label="Next day"
            onPress={() => setDate(addDays(date, 1))}
          />
        </View>
      ) : null}
      {!list ? (
        <LoadingBlock />
      ) : list.length ? (
        list.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/admin/reservation/${r.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${formatTime(r.startsAt)}, ${r.guestName}, ${r.partySize} guests, ${STATUS_LABEL[r.status]}`}
            style={styles.row}
          >
            <Text variant="h3" color="accent" style={{ width: 60 }}>
              {formatTime(r.startsAt)}
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="title">
                {r.guestName} · {r.partySize}
              </Text>
              <Text variant="caption" color="textMuted">
                {term ? `${formatDateShort(r.startsAt)} · ` : ''}
                {r.reference} · {STATUS_LABEL[r.status]}
                {r.occasion ? ` · ${r.occasion}` : ''}
                {r.dietaryNotes || r.accessibilityNotes ? ' · notes' : ''}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textSubtle} />
          </Pressable>
        ))
      ) : (
        <EmptyState icon="calendar" title="No bookings" />
      )}
      <PremiumButton
        label="Offer freed tables to the waitlist"
        variant="secondary"
        style={{ marginTop: spacing.xl }}
        loading={match.isPending}
        onPress={() => match.mutate({ date })}
      />
      {match.data ? (
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          {match.data.length
            ? `${match.data.length} guest(s) offered a table.`
            : 'Nobody waiting could be matched.'}
        </Text>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  dayNav: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
