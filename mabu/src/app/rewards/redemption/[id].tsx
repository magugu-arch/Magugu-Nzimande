import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Card, Header, LoadingBlock, PremiumButton, QRCode, Screen, Text } from '@/components/ui';
import { formatDateWithYear } from '@/domain/shared/format';
import { useRpc } from '@/services/queries';
import { spacing } from '@/theme';

/** §35 "Show redemption code / QR where applicable". */
export default function Redemption() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallet = useRpc('rewards.wallet');
  const r = wallet.data?.redemptions?.find((x) => x.id === id);
  if (!r)
    return (
      <Screen header={<Header title="Your reward" />}>
        <LoadingBlock />
      </Screen>
    );

  return (
    <Screen
      meta={{ title: 'Redemption', noindex: true }}
      header={<Header title="Your reward" onBack={() => router.replace('/rewards')} />}
    >
      <Text variant="eyebrow" color="accent" style={{ marginTop: spacing.xl }} align="center">
        Ready to enjoy
      </Text>
      <Text
        variant="h1"
        align="center"
        accessibilityRole="header"
        style={{ marginTop: spacing.sm }}
      >
        {r.rewardName}
      </Text>
      <Card style={{ marginTop: spacing.xl, alignItems: 'center', gap: spacing.md }}>
        {r.status === 'issued' ? (
          <>
            <QRCode value={`MABU:REWARD:${r.code}`} size={190} label={`Reward code ${r.code}`} />
            <Text variant="h2" selectable>
              {r.code}
            </Text>
            <Text variant="bodySmall" color="textMuted" align="center">
              Show this to your host. Valid until {formatDateWithYear(r.expiresAt)}; it can be used
              once.
            </Text>
          </>
        ) : (
          <Text variant="body" color="textMuted">
            {r.status === 'used'
              ? `Enjoyed on ${r.usedAt ? formatDateWithYear(r.usedAt) : ''}.`
              : `This reward is ${r.status}.`}
          </Text>
        )}
      </Card>
      <View style={{ marginTop: spacing.xl }}>
        <PremiumButton label="Book a table" onPress={() => router.navigate('/book')} />
      </View>
    </Screen>
  );
}
