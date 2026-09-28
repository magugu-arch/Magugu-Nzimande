import { View } from 'react-native';
import { router } from 'expo-router';
import { VoucherCard } from '@/components/mabu/Cards';
import {
  EmptyState,
  ErrorState,
  Header,
  LoadingBlock,
  PremiumButton,
  Screen,
} from '@/components/ui';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { spacing } from '@/theme';

/** §16 My Vouchers — purchased and received, with balance and status. */
export default function MyVouchers() {
  const q = useRpc('vouchers.mine');
  return (
    <Screen
      header={<Header title="My vouchers" />}
      footer={
        <PremiumButton
          label="Gift Mábu"
          variant="secondary"
          onPress={() => router.push('/vouchers/new')}
        />
      }
    >
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : q.data.length ? (
        <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
          {q.data.map((v) => (
            <VoucherCard key={v.id} voucher={v} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="gift"
          title="No vouchers yet"
          body="Vouchers you buy or receive will be kept safely here."
        />
      )}
    </Screen>
  );
}
