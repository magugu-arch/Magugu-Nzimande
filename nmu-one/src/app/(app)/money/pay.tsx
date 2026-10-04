import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@/core/domain/money';
import type { Money } from '@/core/domain/models';
import { useAccount } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  QueryState,
  Screen,
  StateView,
  Text,
  TextField,
  Touchable,
  colors,
  radius,
  spacing,
} from '@/design';
import { parseRands } from '@/features/money/amount';
import { PaymentSheet } from '@/features/money/payment';
import { useSession } from '@/state/session';

/** An approved payment flow for fees (brief §8). */
export default function Pay() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const account = useAccount();
  const [mode, setMode] = useState<'full' | 'other'>('full');
  const [other, setOther] = useState('');
  const [sheet, setSheet] = useState(false);

  return (
    <Screen header={<Header title="Make a payment" fallbackHref="/money" />} testID="pay">
      <QueryState query={account} what="your balance">
        {(a) => {
          if (a.balance.cents <= 0) {
            return (
              <StateView
                kind="empty"
                title="Nothing to pay"
                body="Your fee account is fully paid."
                actionLabel="Back to fees"
                onAction={() => router.dismissTo('/money')}
              />
            );
          }
          const otherCents = parseRands(other);
          const tooMuch = otherCents !== null && otherCents > a.balance.cents;
          const amount: Money | null =
            mode === 'full'
              ? a.balance
              : otherCents && !tooMuch
                ? { cents: otherCents, currency: 'ZAR' }
                : null;
          return (
            <View style={styles.body}>
              <Text variant="title2">How much would you like to pay?</Text>
              <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
                <Option
                  selected={mode === 'full'}
                  onPress={() => setMode('full')}
                  title={`Full balance · ${formatMoney(a.balance)}`}
                  subtitle="Settles your account"
                  testID="amount-full"
                />
                <Option
                  selected={mode === 'other'}
                  onPress={() => setMode('other')}
                  title="Another amount"
                  subtitle="Pay part now, the rest later"
                  testID="amount-other"
                />
              </View>
              {mode === 'other' ? (
                <TextField
                  label="Amount in rand"
                  value={other}
                  onChangeText={setOther}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 1500"
                  error={
                    other && !otherCents
                      ? 'Enter an amount like 1500 or 1500.50'
                      : tooMuch
                        ? `That’s more than you owe (${formatMoney(a.balance)})`
                        : null
                  }
                />
              ) : null}
              <Card tone="sunken">
                <Text variant="caption" color={colors.textSecondary}>
                  Payments usually reflect on your statement within minutes. Your receipt is saved
                  here either way.
                </Text>
              </Card>
              <Button
                label={amount ? `Continue · ${formatMoney(amount)}` : 'Continue'}
                variant="primary"
                fullWidth
                disabled={!amount}
                onPress={() => setSheet(true)}
                testID="pay-continue"
              />
              {amount ? (
                <PaymentSheet
                  visible={sheet}
                  amount={amount}
                  purpose="fees"
                  description="Tuition and residence fees, paid to Nelson Mandela University."
                  onClose={() => setSheet(false)}
                  onPaid={async (receipt) => {
                    setSheet(false);
                    await queryClient.invalidateQueries({ queryKey: ['account', userId] });
                    await queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
                    router.replace(`/money/receipt/${receipt.id}`);
                  }}
                />
              ) : null}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function Option({
  selected,
  onPress,
  title,
  subtitle,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  testID: string;
}) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={[styles.option, selected ? styles.optionOn : null]}
      testID={testID}
    >
      <View style={[styles.radio, selected ? styles.radioOn : null]} />
      <View style={{ flex: 1 }}>
        <Text variant="label">{title}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {subtitle}
        </Text>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionOn: { borderColor: colors.navy },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioOn: { borderColor: colors.navy, borderWidth: 7 },
});
