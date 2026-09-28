import { AdminScreen } from '@/components/admin/Admin';
import { EmptyState, LoadingBlock, Text } from '@/components/ui';
import { formatDateShort, formatTime } from '@/domain/shared/format';
import { useRpc } from '@/services/queries';
import { colors, spacing } from '@/theme';

/** §19 "Log sensitive actions such as cancellation, voucher redemption and admin changes." */
export default function AdminAudit() {
  const q = useRpc('admin.audit');
  return (
    <AdminScreen title="Audit log" adminOnly>
      {!q.data ? (
        <LoadingBlock />
      ) : q.data.length ? (
        q.data.map((a) => (
          <Text
            key={a.id}
            variant="caption"
            color="textMuted"
            style={{
              paddingVertical: spacing.sm,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
            }}
          >
            {formatDateShort(a.at)} {formatTime(a.at)} · {a.actorRole} {a.actorId} · {a.action} ·{' '}
            {a.entityType}:{a.entityId}
          </Text>
        ))
      ) : (
        <EmptyState icon="shield" title="No sensitive actions yet" />
      )}
    </AdminScreen>
  );
}
