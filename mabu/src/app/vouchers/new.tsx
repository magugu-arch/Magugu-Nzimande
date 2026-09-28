import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_TEST_TOKEN, PaymentChoice } from '@/components/mabu/PaymentChoice';
import {
  Chip,
  Header,
  InlineNotice,
  Photo,
  PremiumButton,
  Screen,
  SectionTitle,
  Segmented,
  Text,
  TextField,
} from '@/components/ui';
import { formatRand } from '@/domain/shared/format';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { isEmail } from '@/domain/shared/validation';
import { errorMessage } from '@/services/api';
import { ACCOUNT_QUERIES, useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';
import { track } from '@/utils/analytics';
import { haptic } from '@/utils/haptics';

const OCCASIONS = ['Birthday', 'Anniversary', 'Thank you', 'Celebration', 'Just because'];

/** The four tiles of the supplied Gift Vouchers design. */
const MOMENTS = [
  { label: 'Dining experiences', photo: 'voucher-dining' },
  { label: 'Special occasions', photo: 'voucher-occasions' },
  { label: 'Private events', photo: 'voucher-private' },
  { label: 'A gift to remember', photo: 'voucher-gift' },
];

/** §12 Gift Mábu: value, recipient, message, delivery, secure payment. */
export default function NewVoucher() {
  const signedIn = useSession((s) => !!s.actor);
  const policy = useRpc('vouchers.policy');
  const [preset, setPreset] = useState<number | 'custom'>(100000);
  const [custom, setCustom] = useState('');
  const [who, setWho] = useState<'other' | 'self'>('other');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [occasion, setOccasion] = useState<string | undefined>();
  const [token, setToken] = useState<string>(DEFAULT_TEST_TOKEN);
  const [key, setKey] = useState(newIdempotencyKey);
  const [formError, setFormError] = useState<string | null>(null);
  const buy = useRpcMutation('vouchers.purchase', [...ACCOUNT_QUERIES]);

  useEffect(() => track('voucher_viewed'), []);

  const amountCents =
    preset === 'custom' ? Math.round(Number(custom.replace(/[^\d]/g, '')) * 100) : preset;
  const p = policy.data;

  const submit = () => {
    if (!signedIn) {
      router.push('/sign-in?reason=voucher');
      return;
    }
    if (
      p &&
      preset === 'custom' &&
      (!amountCents || amountCents < p.minCents || amountCents > p.maxCents)
    ) {
      setFormError(
        `Please choose an amount from ${formatRand(p.minCents)} to ${formatRand(p.maxCents)}.`,
      );
      return;
    }
    if (who === 'other' && (!recipientName.trim() || !isEmail(recipientEmail))) {
      setFormError("Please add the recipient's name and email.");
      return;
    }
    setFormError(null);
    buy.mutate(
      {
        amountCents,
        forSelf: who === 'self',
        recipientName,
        recipientEmail,
        message: message || undefined,
        occasion,
        delivery: who === 'self' ? 'in-app' : 'email',
        methodToken: token,
        idempotencyKey: key,
      },
      {
        onSuccess: (v) => {
          haptic.success();
          router.replace(`/vouchers/${v.id}?new=1`);
        },
        onError: () => {
          haptic.warn();
          setKey(newIdempotencyKey());
        },
      },
    );
  };

  return (
    <Screen
      meta={{
        title: 'Gift Vouchers',
        description:
          'Give an evening at Mábu. Digital gift vouchers for fine dining in Waterfall City, Midrand, delivered by email in moments.',
        path: '/vouchers/new',
      }}
      header={<Header title="Gift Mábu" />}
      footer={
        <PremiumButton
          label={`Gift Mábu · ${formatRand(amountCents || 0)}`}
          loading={buy.isPending}
          onPress={submit}
          testID="voucher-buy"
        />
      }
    >
      <Photo
        photo="hero-vouchers"
        label="A black and gold Mábu gift voucher tied with a satin ribbon"
        style={styles.hero}
      />
      <Text variant="eyebrow" color="accent" style={[styles.tracked, { marginTop: spacing.xl }]}>
        Gift vouchers
      </Text>
      <Text variant="h1" style={{ marginTop: spacing.xs }} accessibilityRole="header">
        Give the gift of Mábu.
      </Text>
      <View style={styles.rule} />
      <Text variant="eyebrow" color="textMuted" style={styles.tracked}>
        Unforgettable experiences.{'\n'}The perfect gift.
      </Text>
      <Text variant="body" color="textMuted" style={{ marginTop: spacing.md }}>
        A digital voucher for an evening to remember, delivered by email in moments.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.momentsRail}
        contentContainerStyle={styles.moments}
      >
        {MOMENTS.map((m) => (
          <View key={m.label} style={styles.moment}>
            <Photo photo={m.photo} label="" style={styles.momentPhoto} />
            <Text variant="eyebrow" style={styles.momentLabel} numberOfLines={1}>
              {m.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      <SectionTitle eyebrow="Value" title="Choose an amount" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(p?.presetsCents ?? [50000, 100000, 150000, 250000]).map((c) => (
          <Chip
            key={c}
            label={formatRand(c)}
            selected={preset === c}
            onPress={() => setPreset(c)}
          />
        ))}
        {p?.customEnabled !== false ? (
          <Chip
            label="Other amount"
            selected={preset === 'custom'}
            onPress={() => setPreset('custom')}
          />
        ) : null}
      </View>
      {preset === 'custom' ? (
        <View style={{ marginTop: spacing.lg }}>
          <TextField
            label="Amount in rand"
            value={custom}
            onChangeText={setCustom}
            keyboardType="number-pad"
            placeholder="e.g. 750"
            hint={p ? `From ${formatRand(p.minCents)} to ${formatRand(p.maxCents)}` : undefined}
          />
        </View>
      ) : null}

      <SectionTitle eyebrow="Recipient" title="Who is it for?" />
      <Segmented
        value={who}
        onChange={setWho}
        options={[
          { value: 'other', label: 'Someone else' },
          { value: 'self', label: 'Myself' },
        ]}
      />
      {who === 'other' ? (
        <View style={{ marginTop: spacing.lg }}>
          <TextField
            label="Their name"
            value={recipientName}
            onChangeText={setRecipientName}
            autoComplete="name"
          />
          <TextField
            label="Their email"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            hint="We email the voucher to them as soon as payment is confirmed."
          />
        </View>
      ) : (
        <Text variant="bodySmall" color="textMuted" style={{ marginTop: spacing.md }}>
          The voucher will be kept in your profile, ready to show when you dine.
        </Text>
      )}

      <SectionTitle eyebrow="Optional" title="Add a message" />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        {OCCASIONS.map((o) => (
          <Chip
            key={o}
            label={o}
            selected={occasion === o}
            onPress={() => setOccasion(occasion === o ? undefined : o)}
          />
        ))}
      </View>
      <TextField
        label="Personal message"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={250}
        hint={`${message.length}/250`}
      />

      <SectionTitle eyebrow="Payment" title="Secure checkout" />
      <PaymentChoice amountCents={amountCents || 0} token={token} onChange={setToken} />
      {p ? (
        <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.md }}>
          {p.terms}
        </Text>
      ) : null}

      {formError || buy.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.xl }}>
          {formError ?? errorMessage(buy.error)}
        </InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 200, borderRadius: radius.lg, marginTop: spacing.md },
  tracked: { letterSpacing: 2.6 },
  rule: { width: 44, height: 2, backgroundColor: colors.accent, marginVertical: spacing.md },
  // Bleeds to the screen edges so the rail scrolls under the gutter.
  momentsRail: { marginHorizontal: -spacing.gutter, marginTop: spacing.lg },
  moments: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  moment: {
    width: 170,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  momentPhoto: { height: 94 },
  momentLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
