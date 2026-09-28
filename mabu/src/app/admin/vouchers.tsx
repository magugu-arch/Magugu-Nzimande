import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen, NumberField, Tile, TileRow } from '@/components/admin/Admin';
import { Card, InlineNotice, PremiumButton, SectionTitle, Text, TextField } from '@/components/ui';
import { formatDateShort, formatDateWithYear, formatRand } from '@/domain/shared/format';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

/**
 * §12 / §18 staff redemption: look up a voucher by code or scanned QR text,
 * redeem all or part of it, and honour one-time reward codes. Every
 * redemption is idempotent and audited.
 */
export default function AdminVouchers() {
  const role = useSession((s) => s.actor?.role);
  const dash = useRpc('admin.dashboard', { date: new Date().toISOString().slice(0, 10) });
  const [code, setCode] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [amount, setAmount] = useState(0);
  const [key, setKey] = useState(newIdempotencyKey);
  const lookup = useRpc('admin.vouchers.lookup', { code: lookupCode }, { enabled: !!lookupCode });
  const redeem = useRpcMutation('admin.vouchers.redeem', [
    'admin.vouchers.lookup',
    'admin.dashboard',
  ]);
  const cancel = useRpcMutation('admin.vouchers.cancel', [
    'admin.vouchers.lookup',
    'admin.dashboard',
  ]);
  const [rewardCode, setRewardCode] = useState('');
  const useReward = useRpcMutation('admin.useRedemption');
  const v = lookup.data?.voucher;

  return (
    <AdminScreen title="Vouchers">
      {dash.data ? (
        <TileRow>
          <Tile label="Sold" value={dash.data.vouchers.soldCount} />
          <Tile label="Sales" value={formatRand(dash.data.vouchers.soldCents)} />
          <Tile label="Outstanding" value={formatRand(dash.data.vouchers.outstandingCents)} />
          <Tile label="Redeemed" value={formatRand(dash.data.vouchers.redeemedCents)} />
        </TileRow>
      ) : null}

      <SectionTitle eyebrow="Redeem" title="Gift voucher" />
      <TextField
        label="Voucher code or scanned QR"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="MABU-XXXX-XXXX"
      />
      <PremiumButton
        label="Look up"
        variant="secondary"
        compact
        onPress={() => setLookupCode(code.trim())}
      />
      {lookup.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.md }}>
          {errorMessage(lookup.error)}
        </InlineNotice>
      ) : null}
      {v ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text variant="h2" color="accent">
            {formatRand(v.remainingCents)}{' '}
            <Text variant="bodySmall" color="textMuted">
              of {formatRand(v.amountCents)}
            </Text>
          </Text>
          <Text variant="body">
            {v.code} · {v.status.replace('_', ' ')}
          </Text>
          <Text variant="caption" color="textMuted">
            For {v.recipientName}
            {v.expiresAt ? ` · valid until ${formatDateWithYear(v.expiresAt)}` : ''}
          </Text>
          {lookup.data?.redemptions.map((r) => (
            <Text key={r.id} variant="caption" color="textSubtle">
              {formatDateShort(r.at)} · {formatRand(r.amountCents)} by {r.staffId}
            </Text>
          ))}
          {v.status === 'active' ? (
            <>
              <NumberField
                label="Amount to redeem (R)"
                value={amount}
                onChange={setAmount}
                hint={`Up to ${formatRand(v.remainingCents)}`}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <PremiumButton
                  label="Redeem"
                  compact
                  disabled={amount <= 0}
                  loading={redeem.isPending}
                  onPress={() =>
                    redeem.mutate(
                      { code: v.code, amountCents: amount * 100, idempotencyKey: key },
                      {
                        onSettled: () => setKey(newIdempotencyKey()),
                        onSuccess: () => setAmount(0),
                      },
                    )
                  }
                />
                <PremiumButton
                  label="Full balance"
                  variant="secondary"
                  compact
                  onPress={() => setAmount(v.remainingCents / 100)}
                />
              </View>
              {role === 'admin' && v.remainingCents === v.amountCents ? (
                <PremiumButton
                  label="Cancel & refund"
                  variant="ghost"
                  compact
                  loading={cancel.isPending}
                  onPress={() => cancel.mutate({ id: v.id, reason: 'Cancelled by admin' })}
                />
              ) : null}
            </>
          ) : null}
          {redeem.isError || cancel.isError ? (
            <InlineNotice tone="danger">{errorMessage(redeem.error ?? cancel.error)}</InlineNotice>
          ) : null}
          {redeem.isSuccess ? (
            <InlineNotice tone="success">{`Redeemed. ${formatRand(redeem.data.remainingCents)} remains.`}</InlineNotice>
          ) : null}
        </Card>
      ) : null}

      <SectionTitle eyebrow="Rewards" title="Reward code" />
      <TextField
        label="Reward code"
        value={rewardCode}
        onChangeText={setRewardCode}
        autoCapitalize="characters"
        placeholder="RW-XXXXXX"
      />
      <PremiumButton
        label="Honour reward"
        variant="secondary"
        compact
        loading={useReward.isPending}
        onPress={() => useReward.mutate({ code: rewardCode.replace(/^MABU:REWARD:/, '') })}
      />
      {useReward.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.md }}>
          {errorMessage(useReward.error)}
        </InlineNotice>
      ) : null}
      {useReward.isSuccess ? (
        <InlineNotice tone="success" style={{ marginTop: spacing.md }}>
          {`${useReward.data.rewardName} — honoured. The code cannot be used again.`}
        </InlineNotice>
      ) : null}
    </AdminScreen>
  );
}
