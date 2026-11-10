import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { isTicketTokenUsable, type SecureTicket } from '@kc-one/contracts';
import { BackHeader, Button, Notice, QueryState, Screen, Text } from '@/components';
import { useSecureTicket, useTickets } from '@/data/queries';
import { SignInGate } from '@/features/auth/SignInGate';
import { TicketCard } from '@/features/tickets/TicketCard';
import { color, radius, space } from '@/theme';

/**
 * Ticket detail. The entry code is requested only when the supporter asks to
 * show it, is never cached, and is dropped the moment it expires. Demo mode
 * shows a deliberately unscannable placeholder instead.
 */
export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tickets = useTickets();
  const [reveal, setReveal] = useState(false);
  const secure = useSecureTicket(id, reveal);

  return (
    <Screen topInset={false} header={<BackHeader title="Ticket" />}>
      <SignInGate title="Sign in for your tickets" body="Tickets belong to your account.">
        <QueryState query={tickets}>
          {(list) => {
            const t = list.find((x) => x.id === id);
            if (!t)
              return (
                <Notice
                  reason="error"
                  title="Ticket not found"
                  body="It may have been transferred or cancelled."
                />
              );
            const demo = t.provenance.state === 'demo';
            return (
              <View style={{ gap: space.xl }}>
                <TicketCard ticket={t} />
                {demo ? <DemoPlaceholder /> : null}
                {!reveal ? (
                  <Button
                    label="Show entry code"
                    icon="qr-code-outline"
                    onPress={() => setReveal(true)}
                    disabled={t.status !== 'active'}
                  />
                ) : (
                  <QueryState
                    query={secure}
                    loading={<Text variant="callout">Requesting your entry code…</Text>}
                  >
                    {(token) => <EntryToken token={token} onExpire={() => void secure.refetch()} />}
                  </QueryState>
                )}
                <Text variant="footnote" color="textTertiary">
                  Entry codes are issued by the official ticketing provider at the moment you show
                  them and expire within five minutes, so screenshots will not scan. Ticket
                  transfers and refunds are handled by the ticketing provider.
                </Text>
              </View>
            );
          }}
        </QueryState>
      </SignInGate>
    </Screen>
  );
}

/** Diagonal hatching with a label. Not a QR code and cannot be read as one. */
function DemoPlaceholder() {
  return (
    <View
      style={styles.placeholder}
      accessible
      accessibilityLabel="Demo placeholder. Not a ticket code. Not valid for entry."
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="hatch"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Line x1="0" y1="0" x2="0" y2="14" stroke={color.lineStrong} strokeWidth="5" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hatch)" />
      </Svg>
      <View style={styles.placeholderLabel}>
        <Text variant="label" style={{ color: color.demoText }}>
          DEMO · NOT VALID FOR ENTRY
        </Text>
      </View>
    </View>
  );
}

function EntryToken({ token, onExpire }: { token: SecureTicket; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const usable = isTicketTokenUsable(token, new Date(now));
  const expiresAt = token.expiresAt;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  useEffect(() => {
    if (left === 0) onExpire();
  }, [left, onExpire]);
  return (
    <View style={{ gap: space.sm }}>
      {/* The provider's rendering component goes here (QR/barcode/NFC), fed by the short-lived token. */}
      <Notice
        compact
        reason="integration_pending"
        title={usable ? 'Entry code ready' : 'Refreshing your code'}
        body={`The ticketing provider's code renderer is connected here. Refreshes in ${left}s.`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 220,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bgRaised,
    borderWidth: 1,
    borderColor: color.lineStrong,
  },
  placeholderLabel: {
    backgroundColor: color.demoBg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 2,
  },
});
