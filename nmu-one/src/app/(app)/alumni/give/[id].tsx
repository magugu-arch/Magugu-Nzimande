import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { asPhotoKey } from '@/content/photos';
import { providers } from '@/core/adapters/registry';
import type { Money, Pledge } from '@/core/domain/models';
import { formatMoney } from '@/core/domain/money';
import { useCampaigns } from '@/data/hooks';
import {
  Button,
  Card,
  Chip,
  HeroBack,
  Icon,
  Notice,
  PhotoHero,
  ProgressBar,
  QueryState,
  Row,
  Screen,
  Segmented,
  StateView,
  Text,
  TextField,
  colors,
  spacing,
} from '@/design';
import { parseRands } from '@/features/money/amount';
import { PaymentSheet } from '@/features/money/payment';
import { showToast } from '@/state/toasts';

/** A bursary giving journey (brief §14, §26 step 14): amount, frequency, approved payment, thanks. */
export default function Give() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campaigns = useCampaigns();
  const [choice, setChoice] = useState<number | 'other' | null>(null);
  const [other, setOther] = useState('');
  const [frequency, setFrequency] = useState<Pledge['frequency']>('once');
  const [paying, setPaying] = useState(false);
  const [pledge, setPledge] = useState<Pledge | null>(null);
  const [error, setError] = useState(false);

  return (
    <Screen padded={false} topInset={false} testID="give">
      <QueryState query={campaigns} what="this campaign">
        {(list) => {
          const c = list.find((x) => x.id === id);
          if (!c) return <StateView kind="empty" title="Campaign not found" actionLabel="All campaigns" onAction={() => router.replace('/alumni/giving')} />;
          const pct = c.raised.cents / c.goal.cents;
          const otherCents = parseRands(other);
          const amount: Money | null =
            choice === 'other' ? (otherCents ? { cents: otherCents, currency: 'ZAR' } : null) : choice !== null ? (c.suggested[choice] ?? null) : null;
          return (
            <>
              <PhotoHero photo={asPhotoKey(c.photo, 'alumniGiving')} eyebrow="Alumni giving" title={c.title} height={300} topBar={<HeroBack fallbackHref="/alumni/giving" />} />
              <View style={styles.body}>
                {pledge ? (
                  <View style={{ gap: spacing.lg }} testID="give-thanks">
                    <View style={styles.thanks}>
                      <Icon name="heart" size={32} color={colors.navy} />
                    </View>
                    <Text variant="title1" align="center" accessibilityRole="header">
                      Thank you
                    </Text>
                    <Text variant="bodyLarge" align="center">
                      {pledge.frequency === 'monthly'
                        ? `Your monthly gift of ${formatMoney(pledge.amount)} to the ${c.title} is set up.`
                        : `Your gift of ${formatMoney(pledge.amount)} to the ${c.title} has been received.`}
                    </Text>
                    <Card tone="sunken">
                      <Text variant="caption" color={colors.textSecondary}>
                        Reference {pledge.reference}. {c.impact}
                      </Text>
                    </Card>
                    <Button label="Back to alumni home" variant="primary" fullWidth onPress={() => router.replace('/home')} />
                  </View>
                ) : (
                  <>
                    <Text variant="bodyLarge">{c.summary}</Text>
                    <View style={{ gap: spacing.xs }}>
                      <ProgressBar value={pct} tone="yellow" label={`${Math.round(pct * 100)}% funded`} />
                      <Text variant="captionStrong">
                        {formatMoney(c.raised, { showCents: false })} of {formatMoney(c.goal, { showCents: false })} · {c.donors.toLocaleString('en-ZA')} donors
                      </Text>
                    </View>
                    <Notice tone="info" icon="sparkles-outline" title="Your impact" body={c.impact} />

                    {c.allowsMonthly ? (
                      <Segmented<Pledge['frequency']>
                        label="How often"
                        value={frequency}
                        onChange={setFrequency}
                        options={[
                          { value: 'once', label: 'Once' },
                          { value: 'monthly', label: 'Monthly' },
                        ]}
                      />
                    ) : null}

                    <View>
                      <Text variant="captionStrong" style={{ marginBottom: spacing.sm }}>
                        Amount{frequency === 'monthly' ? ' each month' : ''}
                      </Text>
                      <Row wrap gap={spacing.sm}>
                        {c.suggested.map((m, i) => (
                          <Chip key={m.cents} label={formatMoney(m, { showCents: false })} selected={choice === i} onPress={() => setChoice(i)} testID={`amount-${m.cents / 100}`} />
                        ))}
                        <Chip label="Other" selected={choice === 'other'} onPress={() => setChoice('other')} />
                      </Row>
                    </View>
                    {choice === 'other' ? (
                      <TextField label="Amount in rand" keyboardType="decimal-pad" value={other} onChangeText={setOther} placeholder="e.g. 200" error={other && !otherCents ? 'Enter an amount like 200' : null} />
                    ) : null}

                    {error ? <Notice tone="danger" title="Your gift wasn’t recorded" body="Please try again." /> : null}

                    <Button
                      label={amount ? `Give ${formatMoney(amount)}${frequency === 'monthly' ? ' a month' : ''}` : 'Choose an amount'}
                      icon="heart"
                      variant="accent"
                      fullWidth
                      disabled={!amount}
                      onPress={() => setPaying(true)}
                      testID="give-continue"
                    />
                    {amount ? (
                      <PaymentSheet
                        visible={paying}
                        amount={amount}
                        purpose="donation"
                        description={`${c.title}${frequency === 'monthly' ? ' · monthly' : ''}`}
                        onClose={() => setPaying(false)}
                        onPaid={async (_r, paymentId) => {
                          try {
                            const p = await providers.alumni.pledge({ campaignId: c.id, amount, frequency, paymentId });
                            setPaying(false);
                            setPledge(p);
                            void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
                            showToast({ title: 'Thank you for giving', tone: 'success' });
                          } catch {
                            setPaying(false);
                            setError(true);
                          }
                        }}
                      />
                    ) : null}
                  </>
                )}
              </View>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter, gap: spacing.lg },
  thanks: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
});
