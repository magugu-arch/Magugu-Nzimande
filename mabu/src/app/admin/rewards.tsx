import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen, NumberField, Row } from '@/components/admin/Admin';
import {
  Card,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  SectionTitle,
  Text,
  TextField,
  ToggleRow,
} from '@/components/ui';
import type { Reward, RewardRule } from '@/domain/rewards/types';
import { formatDateShort, formatPoints } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';

const REFRESH = ['admin.rewards', 'rewards.programme', 'rewards.wallet'] as const;

/**
 * §34 / §44 admin control: earning rules, reward catalogue, expiry, manual
 * issuance, reversals — all audited — and a guest's ledger.
 */
export default function AdminRewards() {
  const q = useRpc('admin.rewards');
  const saveSettings = useRpcMutation('admin.rewardsSettings.save', [...REFRESH]);
  const [expiry, setExpiry] = useState<number | null>(null);

  return (
    <AdminScreen title="Rewards programme" adminOnly>
      {!q.data ? (
        <LoadingBlock />
      ) : (
        <>
          <SectionTitle eyebrow="Earning" title="Rules" />
          {q.data.rules.map((r) => (
            <RuleEditor key={r.id} rule={r} />
          ))}

          <SectionTitle eyebrow="Catalogue" title="Rewards" />
          {q.data.rewards.map((r) => (
            <RewardEditor
              key={r.id}
              reward={r}
              tiers={q.data.tiers.map((t) => ({ id: t.id, name: t.name }))}
            />
          ))}

          <SectionTitle eyebrow="Expiry" title="Points lifetime" />
          <Row>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Months until unspent points expire"
                value={expiry ?? q.data.settings.pointsExpiryMonths}
                onChange={setExpiry}
              />
            </View>
          </Row>
          <PremiumButton
            label="Save expiry"
            variant="secondary"
            compact
            disabled={expiry === null}
            loading={saveSettings.isPending}
            onPress={() => expiry !== null && saveSettings.mutate({ pointsExpiryMonths: expiry })}
          />
          <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.sm }}>
            Applies to points earned from now on. Tiers:{' '}
            {q.data.tiers.map((t) => `${t.name} ${formatPoints(t.minLifetimePoints)}+`).join(' · ')}
          </Text>

          <SectionTitle eyebrow="Guests" title="Ledger & corrections" />
          <Ledger />
        </>
      )}
    </AdminScreen>
  );
}

function RuleEditor({ rule }: { rule: RewardRule }) {
  const [r, setR] = useState(rule);
  const save = useRpcMutation('admin.rule.save', [...REFRESH]);
  const dirty = JSON.stringify(r) !== JSON.stringify(rule);
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <ToggleRow
        label={r.name}
        description={`Trigger: ${r.trigger.replace('_', ' ')}`}
        value={r.active}
        onChange={(active) => setR({ ...r, active })}
      />
      <NumberField
        label={r.pointsPer100Rand !== undefined ? 'Points per R100' : 'Points'}
        value={r.pointsPer100Rand ?? r.points}
        onChange={(v) =>
          setR(
            r.pointsPer100Rand !== undefined ? { ...r, pointsPer100Rand: v } : { ...r, points: v },
          )
        }
      />
      {dirty ? (
        <PremiumButton
          label="Save rule"
          compact
          loading={save.isPending}
          onPress={() => save.mutate(r)}
        />
      ) : null}
      {save.isError ? <InlineNotice tone="danger">{errorMessage(save.error)}</InlineNotice> : null}
    </Card>
  );
}

function RewardEditor({
  reward,
  tiers,
}: {
  reward: Reward;
  tiers: { id: string; name: string }[];
}) {
  const [r, setR] = useState(reward);
  const save = useRpcMutation('admin.reward.save', [...REFRESH]);
  const dirty = JSON.stringify(r) !== JSON.stringify(reward);
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <ToggleRow
        label={r.name}
        description={
          r.tierIds?.length
            ? `Tiers: ${tiers
                .filter((t) => r.tierIds?.includes(t.id))
                .map((t) => t.name)
                .join(', ')}`
            : 'All tiers'
        }
        value={r.active}
        onChange={(active) => setR({ ...r, active })}
      />
      <Row>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Points cost"
            value={r.pointsCost}
            onChange={(pointsCost) => setR({ ...r, pointsCost })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Code valid (days)"
            value={r.redemptionValidDays}
            onChange={(redemptionValidDays) => setR({ ...r, redemptionValidDays })}
          />
        </View>
      </Row>
      {dirty ? (
        <PremiumButton
          label="Save reward"
          compact
          loading={save.isPending}
          onPress={() => save.mutate(r)}
        />
      ) : null}
      {save.isError ? <InlineNotice tone="danger">{errorMessage(save.error)}</InlineNotice> : null}
    </Card>
  );
}

function Ledger() {
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState('');
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState('');
  const ledger = useRpc('admin.ledger', { email: lookup }, { enabled: !!lookup });
  const adjust = useRpcMutation('admin.adjust', ['admin.ledger', 'rewards.wallet']);
  const reverse = useRpcMutation('admin.reverse', ['admin.ledger', 'rewards.wallet']);
  const account = ledger.data?.account;

  return (
    <View>
      <TextField
        label="Guest email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <PremiumButton
        label="Look up"
        variant="secondary"
        compact
        onPress={() => setLookup(email.trim())}
      />
      {ledger.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.md }}>
          {errorMessage(ledger.error)}
        </InlineNotice>
      ) : null}
      {ledger.data ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text variant="title">{ledger.data.guest.name || ledger.data.guest.email}</Text>
          {account ? (
            <>
              <Text variant="body" color="accent">
                {formatPoints(account.balancePoints)} points ·{' '}
                {formatPoints(account.lifetimePoints)} lifetime · {account.tierId}
              </Text>
              <Row>
                <View style={{ flex: 1 }}>
                  <NumberField
                    label="Points (+ issue / − deduct)"
                    value={points}
                    onChange={setPoints}
                  />
                </View>
              </Row>
              <TextField label="Reason (audited)" value={reason} onChangeText={setReason} />
              <PremiumButton
                label="Apply adjustment"
                compact
                disabled={!points || !reason.trim()}
                loading={adjust.isPending}
                onPress={() =>
                  adjust.mutate(
                    { accountId: account.id, points, reason },
                    {
                      onSuccess: () => {
                        setPoints(0);
                        setReason('');
                      },
                    },
                  )
                }
              />
              {adjust.isError || reverse.isError ? (
                <InlineNotice tone="danger">
                  {errorMessage(adjust.error ?? reverse.error)}
                </InlineNotice>
              ) : null}
              {ledger.data.history.map((t) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: 4,
                  }}
                >
                  <Text variant="caption" style={{ flex: 1 }}>
                    {formatDateShort(t.createdAt)} · {t.type} · {t.description}
                  </Text>
                  <Text variant="caption" color={t.points > 0 ? 'success' : 'textMuted'}>
                    {t.points > 0 ? '+' : ''}
                    {t.points}
                  </Text>
                  {t.type === 'earn' || t.type === 'redeem' ? (
                    <PremiumButton
                      label="Reverse"
                      variant="ghost"
                      compact
                      onPress={() =>
                        reverse.mutate({ transactionId: t.id, reason: 'Corrected by admin' })
                      }
                    />
                  ) : null}
                </View>
              ))}
            </>
          ) : (
            <Text variant="bodySmall" color="textMuted">
              Not a Rewards member.
            </Text>
          )}
        </Card>
      ) : null}
    </View>
  );
}
