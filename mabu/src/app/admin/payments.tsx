import { View } from 'react-native';
import { AdminScreen } from '@/components/admin/Admin';
import { Card, EmptyState, LoadingBlock, PremiumButton, Text } from '@/components/ui';
import { formatDateShort, formatRand, formatTime } from '@/domain/shared/format';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';

/**
 * §23 "If payment succeeds but confirmation is delayed, place the transaction
 * in a pending state and reconcile server-side." In production a gateway
 * webhook does this; here an admin can settle what the mock gateway left pending.
 */
export default function AdminPayments() {
  const q = useRpc('admin.payments.pending');
  const settle = useRpcMutation('admin.payments.settle', [
    'admin.payments.pending',
    'admin.dashboard',
  ]);
  return (
    <AdminScreen title="Payments" adminOnly>
      {!q.data ? (
        <LoadingBlock />
      ) : q.data.length ? (
        q.data.map((p) => (
          <Card key={p.id} style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Text variant="title">
              {p.purpose} · {formatRand(p.amountCents)}
            </Text>
            <Text variant="caption" color="textMuted">
              {formatDateShort(p.createdAt)} {formatTime(p.createdAt)} · {p.providerRef ?? p.id}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <PremiumButton
                label="Mark paid"
                compact
                onPress={() => settle.mutate({ id: p.id, status: 'succeeded' })}
              />
              <PremiumButton
                label="Mark failed"
                variant="ghost"
                compact
                onPress={() => settle.mutate({ id: p.id, status: 'failed' })}
              />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState icon="check-circle" title="Nothing awaiting reconciliation" />
      )}
    </AdminScreen>
  );
}
