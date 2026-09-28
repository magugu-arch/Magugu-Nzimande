import { CompletePayment } from '@/components/mabu/CompletePayment';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { VoucherCard } from '@/components/mabu/Cards';
import {
  Card,
  ErrorState,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  QRCode,
  Screen,
  Text,
} from '@/components/ui';
import { formatDateWithYear, formatRand } from '@/domain/shared/format';
import { voucherQrPayload } from '@/domain/vouchers/service';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { spacing } from '@/theme';
import { shareText } from '@/utils/linking';

/** §12: the digital voucher with its unique code and QR, kept in the profile. */
export default function VoucherScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const q = useRpc('vouchers.get', { id }, { refetchInterval: 15_000 });
  const policy = useRpc('vouchers.policy');

  if (q.isPending)
    return (
      <Screen header={<Header title="Voucher" />}>
        <LoadingBlock />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen header={<Header title="Voucher" />}>
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  const v = q.data;
  const usable = v.status === 'active';

  return (
    <Screen
      meta={{ title: 'Your voucher', noindex: true }}
      header={
        <Header
          title="Gift voucher"
          onBack={isNew ? () => router.replace('/profile') : undefined}
        />
      }
    >
      {isNew && usable ? (
        <InlineNotice tone="success" style={{ marginTop: spacing.md }}>
          {v.forSelf
            ? 'Your voucher is ready.'
            : `Thank you. Your gift is on its way to ${v.recipientEmail}.`}
        </InlineNotice>
      ) : null}
      {v.status === 'pending_payment' ? (
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <CompletePayment
            purpose="voucher"
            referenceId={v.id}
            autoOpen={!!isNew}
            refresh={['vouchers.get', 'vouchers.mine']}
          />
          <InlineNotice tone="info">
            Your payment is being confirmed. The voucher is issued — and emailed — the moment it
            lands.
          </InlineNotice>
        </View>
      ) : null}
      <View style={{ marginTop: spacing.lg }}>
        <VoucherCard voucher={v} onPress={() => undefined} />
      </View>

      {usable ? (
        <Card style={{ marginTop: spacing.xl, alignItems: 'center', gap: spacing.md }}>
          <QRCode
            value={voucherQrPayload(v.code)}
            size={200}
            label={`Voucher QR code for ${v.code}`}
          />
          <Text variant="h3" selectable>
            {v.code}
          </Text>
          <Text variant="bodySmall" color="textMuted" align="center">
            Show this when you settle the bill. It may be used over more than one visit.
          </Text>
          <Text variant="price" color="accent">
            {formatRand(v.remainingCents)} available
          </Text>
        </Card>
      ) : null}

      {v.message ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text variant="quote">&ldquo;{v.message}&rdquo;</Text>
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        {v.expiresAt ? (
          <Text variant="bodySmall" color="textMuted">
            Valid until {formatDateWithYear(v.expiresAt)}.
          </Text>
        ) : null}
        {policy.data ? (
          <Text variant="caption" color="textSubtle">
            {policy.data.terms}
          </Text>
        ) : null}
      </View>

      {usable ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <PremiumButton label="Book a table to use it" onPress={() => router.navigate('/book')} />
          <PremiumButton
            label="Share voucher code"
            variant="secondary"
            icon="share"
            onPress={() =>
              void shareText(
                'Mábu gift voucher',
                `A Mábu gift voucher for ${formatRand(v.amountCents)}. Code: ${v.code}`,
              )
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
