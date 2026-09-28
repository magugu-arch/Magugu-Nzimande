import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminScreen } from '@/components/admin/Admin';
import { ReservationSummary } from '@/components/mabu/Cards';
import {
  Card,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  SectionTitle,
  Text,
  TextField,
} from '@/components/ui';
import { formatDateShort, formatTime } from '@/domain/shared/format';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';

const REFRESH = ['admin.reservation', 'admin.reservations', 'admin.dashboard'] as const;

/** Staff view of one booking: guest notes, internal notes, lifecycle actions, audit trail. */
export default function AdminReservation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRpc('admin.reservation', { id });
  const complete = useRpcMutation('admin.complete', [...REFRESH]);
  const noShow = useRpcMutation('admin.noShow', [...REFRESH]);
  const cancel = useRpcMutation('admin.cancel', [...REFRESH]);
  const addNote = useRpcMutation('admin.addNote', [...REFRESH]);
  const [note, setNote] = useState('');
  const error = complete.error ?? noShow.error ?? cancel.error ?? addNote.error;

  return (
    <AdminScreen title="Booking">
      {!q.data ? (
        <LoadingBlock />
      ) : (
        <>
          <Text variant="h2" style={{ marginTop: spacing.lg }}>
            {q.data.reservation.guestName}
          </Text>
          <Text variant="bodySmall" color="textMuted" selectable>
            {q.data.reservation.guestPhone} · {q.data.reservation.guestEmail}
          </Text>
          <View style={{ marginTop: spacing.lg }}>
            <ReservationSummary reservation={q.data.reservation} />
          </View>
          {[
            q.data.reservation.dietaryNotes,
            q.data.reservation.accessibilityNotes,
            q.data.reservation.specialRequest,
            q.data.reservation.occasionNote,
          ].some(Boolean) ? (
            <Card style={{ marginTop: spacing.md, gap: spacing.xs }}>
              <Text variant="eyebrow" color="textMuted">
                Guest notes
              </Text>
              {[
                ['Dietary', q.data.reservation.dietaryNotes],
                ['Access', q.data.reservation.accessibilityNotes],
                ['Request', q.data.reservation.specialRequest],
                ['Occasion', q.data.reservation.occasionNote],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <Text key={k} variant="body">
                    {k}: {v}
                  </Text>
                ))}
            </Card>
          ) : null}

          {['confirmed', 'rescheduled', 'requested'].includes(q.data.reservation.status) ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
              <PremiumButton
                label="Mark visit completed"
                loading={complete.isPending}
                onPress={() => complete.mutate({ id })}
              />
              <PremiumButton
                label="Mark as no-show"
                variant="secondary"
                loading={noShow.isPending}
                onPress={() => noShow.mutate({ id })}
              />
              <PremiumButton
                label="Cancel on the guest's behalf"
                variant="ghost"
                loading={cancel.isPending}
                onPress={() =>
                  cancel.mutate({
                    id,
                    idempotencyKey: newIdempotencyKey(),
                    reason: 'Cancelled by restaurant',
                  })
                }
              />
            </View>
          ) : null}
          {error ? (
            <InlineNotice tone="danger" style={{ marginTop: spacing.md }}>
              {errorMessage(error)}
            </InlineNotice>
          ) : null}

          <SectionTitle eyebrow="Internal only" title="Staff notes" />
          <Text variant="caption" color="textSubtle" style={{ marginBottom: spacing.md }}>
            Never shown to the guest.
          </Text>
          {q.data.notes.map((n) => (
            <Card key={n.id} style={{ marginBottom: spacing.sm }}>
              <Text variant="body">{n.body}</Text>
              <Text variant="caption" color="textSubtle">
                {formatDateShort(n.createdAt)} {formatTime(n.createdAt)}
              </Text>
            </Card>
          ))}
          <TextField label="Add a note" value={note} onChangeText={setNote} multiline />
          <PremiumButton
            label="Save note"
            variant="secondary"
            disabled={!note.trim()}
            loading={addNote.isPending}
            onPress={() => addNote.mutate({ id, body: note }, { onSuccess: () => setNote('') })}
          />

          <SectionTitle eyebrow="Audit" title="History" />
          {q.data.history.map((e) => (
            <Text key={e.id} variant="bodySmall" color="textMuted" style={{ paddingVertical: 4 }}>
              {formatDateShort(e.occurredAt)} {formatTime(e.occurredAt)} · {e.eventType} ·{' '}
              {e.actorId}
            </Text>
          ))}
        </>
      )}
    </AdminScreen>
  );
}
