import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { PressableScale } from '@/components/PressableScale';
import { SheetScaffold } from '@/components/SheetScaffold';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { CheckoutOutcome } from '@/domain/types';
import { providers } from '@/providers';
import { useBag } from '@/store/bag';
import { usePrefs } from '@/store/prefs';

type Phase = 'review' | 'working' | 'done';

const OUTCOMES: Record<
  CheckoutOutcome,
  { tone: 'ok' | 'warn' | 'bad'; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }
> = {
  confirmed: {
    tone: 'ok',
    icon: 'checkmark',
    title: 'Order placed (demo)',
    body: 'This sample order exists only on this device. Nothing was charged and nothing will be delivered.',
  },
  pending: {
    tone: 'warn',
    icon: 'time-outline',
    title: 'Waiting for payment confirmation',
    body: 'Checkout hasn’t confirmed the payment yet. The order updates by itself once it does — checking again never creates a second order.',
  },
  failed: {
    tone: 'bad',
    icon: 'alert-circle-outline',
    title: 'Payment didn’t go through',
    body: 'Nothing was charged and your bag is just as you left it. Try again, or use another method in checkout.',
  },
  cancelled: {
    tone: 'warn',
    icon: 'arrow-undo-outline',
    title: 'Checkout cancelled',
    body: 'No order was placed. Your bag is unchanged.',
  },
};

/**
 * The handoff to the platform's own checkout, simulated. Card details are
 * never typed into the app. Every attempt has one idempotency key, so a
 * double tap, a retry or "check again" yields one order at most; and each
 * outcome the real integration must handle has its own state.
 */
export default function Checkout() {
  const { colors } = useTheme();
  const lines = useBag((s) => s.lines);
  const clear = useBag((s) => s.clear);
  const market = usePrefs((s) => s.market);
  const [simulate, setSimulate] = useState<CheckoutOutcome>('confirmed');
  const [phase, setPhase] = useState<Phase>('review');
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // One key per attempt, made on the first tap and reused by every retry of it.
  const key = useRef<string | null>(null);

  const run = async (wanted: CheckoutOutcome) => {
    key.current ??= `attempt-${Date.now()}`;
    setPhase('working');
    setProblem(null);
    const checked = await providers.commerce.revalidateCart(lines, market);
    if (checked.problems.length) {
      setProblem('Some pieces changed since you added them. Review your bag before paying.');
      setPhase('review');
      return;
    }
    const session = await providers.commerce.startCheckout(lines, market, key.current, wanted);
    setOutcome(session.outcome ?? 'failed');
    if (session.outcome === 'confirmed' && session.orderId) {
      setOrderId(session.orderId);
      clear();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (session.outcome === 'failed') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setPhase('done');
  };

  const footer =
    phase === 'review' ? (
      <Button
        label="Continue to checkout (demo)"
        onPress={() => void run(simulate)}
        testID="checkout-go"
      />
    ) : phase === 'working' ? (
      <Button label="Working…" busy onPress={() => undefined} />
    ) : outcome === 'confirmed' ? (
      <Button
        label="Track this order"
        icon="car-outline"
        onPress={() => {
          router.dismissAll();
          router.push({ pathname: '/orders/[id]', params: { id: orderId! } });
        }}
      />
    ) : outcome === 'pending' ? (
      <Button label="Check again" onPress={() => void run('confirmed')} />
    ) : outcome === 'failed' ? (
      <Button
        label="Try again"
        onPress={() => {
          key.current = null;
          setSimulate('confirmed');
          setPhase('review');
        }}
      />
    ) : (
      <Button label="Back to bag" onPress={() => router.back()} />
    );

  return (
    <SheetScaffold title="Checkout" footer={footer} closable={phase !== 'working'}>
      {phase === 'review' ? (
        <View style={{ gap: space.l }}>
          <Callout icon="shield-checkmark-outline" title="Demo — no real order or payment.">
            In the app, MAXHOSA AFRICA’s approved checkout takes over here. Card details are never
            typed into this app.
          </Callout>
          {problem ? (
            <Callout icon="alert-circle-outline" title="Check your bag">
              {problem}
            </Callout>
          ) : null}
          <View style={{ gap: space.s }}>
            <Text variant="footnote" weight="700" color="ink3">
              Presenter: simulate the checkout result
            </Text>
            <View
              style={[styles.segmented, { backgroundColor: colors.sunk }]}
              accessibilityRole="radiogroup"
            >
              {(Object.keys(OUTCOMES) as CheckoutOutcome[]).map((o) => (
                <PressableScale
                  key={o}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: simulate === o }}
                  onPress={() => setSimulate(o)}
                  style={[styles.segment, simulate === o && { backgroundColor: colors.card }]}
                >
                  <Text variant="footnote" weight="600" color={simulate === o ? 'ink' : 'ink2'}>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        </View>
      ) : null}
      {phase === 'working' ? (
        <Text variant="callout" color="ink2" accessibilityLiveRegion="polite">
          Re-checking prices and stock, then handing over to checkout (simulated)…
        </Text>
      ) : null}
      {phase === 'done' && outcome ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.outcome}
          accessibilityLiveRegion="polite"
        >
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  OUTCOMES[outcome].tone === 'ok'
                    ? colors.greenSoft
                    : OUTCOMES[outcome].tone === 'bad'
                      ? colors.rustSoft
                      : colors.ochreSoft,
              },
            ]}
          >
            <Ionicons
              name={OUTCOMES[outcome].icon}
              size={28}
              color={
                OUTCOMES[outcome].tone === 'ok'
                  ? colors.green
                  : OUTCOMES[outcome].tone === 'bad'
                    ? colors.rust
                    : colors.ink
              }
            />
          </View>
          <Text variant="title" align="center">
            {OUTCOMES[outcome].title}
          </Text>
          <Text variant="callout" color="ink2" align="center">
            {orderId && outcome === 'confirmed' ? `${orderId}: ` : ''}
            {OUTCOMES[outcome].body}
          </Text>
        </Animated.View>
      ) : null}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', padding: 2, borderRadius: 10, gap: 2 },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  outcome: { alignItems: 'center', gap: space.s, paddingVertical: space.l },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s,
  },
});
