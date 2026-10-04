import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDayLong, formatTime } from '@/core/time/sast';
import { useTickets } from '@/data/hooks';
import {
  BrandInline,
  Button,
  Card,
  Divider,
  Header,
  Pill,
  QRCode,
  QueryState,
  Row,
  Screen,
  StateView,
  Text,
  colors,
  radius,
  spacing,
} from '@/design';

/** A ticket with a QR code for check-in (brief §12 "QR check-in where available"). */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tickets = useTickets();
  return (
    <Screen header={<Header title="Ticket" fallbackHref="/events" />} testID="ticket">
      <QueryState query={tickets} what="your ticket">
        {(list) => {
          const t = list.find((x) => x.id === id);
          if (!t) return <StateView kind="empty" title="Ticket not found" actionLabel="Events" onAction={() => router.replace('/events')} />;
          return (
            <View style={{ gap: spacing.xl }}>
              <Card tone="navy" style={styles.ticket} testID="ticket-card">
                <Row justify="space-between">
                  <BrandInline tone="onDark" />
                  <Pill label={t.status === 'valid' ? 'Valid' : t.status === 'used' ? 'Used' : 'Cancelled'} tone={t.status === 'valid' ? 'yellow' : 'onDark'} />
                </Row>
                <Text variant="title1" color={colors.white} style={{ marginTop: spacing.lg }} accessibilityRole="header">
                  {t.eventTitle}
                </Text>
                <Text variant="body" color={colors.textOnDarkMuted}>
                  {formatDayLong(t.start)} · {formatTime(t.start)}
                </Text>
                <Text variant="body" color={colors.textOnDarkMuted}>
                  {t.venue}
                </Text>
                <View style={styles.qrWrap}>
                  <QRCode value={`NMUONE-TICKET:${t.code}`} size={200} label={`Ticket QR code. Ticket number ${t.code}`} />
                </View>
                <Divider tone="onDark" />
                <Row justify="space-between" style={{ marginTop: spacing.md }}>
                  <View>
                    <Text variant="overline" color={colors.textOnDarkMuted}>
                      Holder
                    </Text>
                    <Text variant="bodyStrong" color={colors.white}>
                      {t.holder}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="overline" color={colors.textOnDarkMuted}>
                      Ticket
                    </Text>
                    <Text variant="bodyStrong" color={colors.white} testID="ticket-code">
                      {t.code}
                    </Text>
                  </View>
                </Row>
              </Card>
              <Text variant="body" color={colors.textSecondary} align="center">
                Show this code at the entrance. It works offline — no signal needed at the gate.
              </Text>
              <Button label="Back to events" variant="secondary" fullWidth onPress={() => router.replace('/events')} />
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ticket: { padding: spacing.xl },
  qrWrap: { alignSelf: 'center', marginVertical: spacing.xl, padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg },
});
