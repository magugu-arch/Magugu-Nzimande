import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatMoney } from '@/core/domain/money';
import { formatDateLong, formatTime } from '@/core/time/sast';
import { useReceipt } from '@/data/hooks';
import { Button, Card, Divider, Header, Icon, QueryState, Row, Screen, Text, colors, spacing } from '@/design';

const METHOD = { card: 'Card', 'instant-eft': 'Instant EFT', 'campus-wallet': 'Campus wallet' } as const;

/** Payment confirmation and receipt (brief §8). Calm, no celebration animation (§19). */
export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const receipt = useReceipt(id);
  return (
    <Screen header={<Header title="Receipt" fallbackHref="/money" />} testID="receipt">
      <QueryState query={receipt} what="this receipt">
        {(r) => (
          <View style={{ gap: spacing.xl }}>
            <View style={styles.done}>
              <View style={styles.tick}>
                <Icon name="checkmark" size={32} color={colors.white} />
              </View>
              <Text variant="title1" align="center" accessibilityRole="header">
                Payment received
              </Text>
              <Text variant="body" color={colors.textSecondary} align="center">
                Thank you. Your statement has been updated.
              </Text>
            </View>
            <Card>
              {[
                ['Amount', formatMoney(r.amount)],
                ['For', r.description],
                ['Paid', `${formatDateLong(r.paidAt)} at ${formatTime(r.paidAt)}`],
                ['Method', METHOD[r.method]],
                ['Reference', r.reference],
              ].map(([k, v], i) => (
                <View key={k}>
                  {i > 0 ? <Divider /> : null}
                  <Row justify="space-between" style={styles.line}>
                    <Text variant="body" color={colors.textSecondary}>
                      {k}
                    </Text>
                    <Text variant="bodyStrong" testID={k === 'Reference' ? 'receipt-reference' : undefined}>
                      {v}
                    </Text>
                  </Row>
                </View>
              ))}
            </Card>
            <Button label="Back to fees" variant="primary" fullWidth onPress={() => router.replace('/money')} testID="receipt-done" />
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
  tick: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  line: { paddingVertical: spacing.md, gap: spacing.lg },
});
