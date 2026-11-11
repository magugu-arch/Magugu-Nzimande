import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  AppHeader,
  Button,
  ConceptImage,
  DemoTag,
  Eyebrow,
  HeaderPill,
  Headline,
  Rule,
  ScrollYProvider,
  Text,
  useScrollOffset,
} from '@/components';
import { useOnboarding } from '@/state/session';
import { color, gutter, maxContentWidth, space } from '@/theme';

const VALUE = [
  [
    'football-outline',
    'Matchday',
    'Fixtures, results and the Match Centre, from verified sources.',
  ],
  ['ticket-outline', 'Tickets and membership', 'Your tickets and member benefits, in one wallet.'],
  [
    'people-outline',
    'Fan Moments',
    'Share your matchday. Every moment is reviewed before it is shown.',
  ],
  [
    'gift-outline',
    'Khosi Rewards',
    'Rewards and offers for the family, from the official programme.',
  ],
] as const;

/**
 * First run. The composition follows the design reference: a full-bleed
 * portrait that falls away into black, a gold-ruled mono eyebrow, a two-line
 * headline with the accent line in gold italic, one honest paragraph and a
 * single flat gold call to action.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const finish = useOnboarding((s) => s.finish);
  const heroHeight = Math.min(Math.max(height * 0.6, 420), 640);
  const enter = (i: number) => FadeInDown.duration(520).delay(120 + i * 70);
  const { offset, onScroll } = useScrollOffset('y');

  return (
    <View style={styles.fill}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
        bounces={false}
      >
        <View style={{ height: heroHeight }}>
          <ScrollYProvider value={offset}>
            <ConceptImage
              imageKey="supporterPortrait"
              style={StyleSheet.absoluteFill}
              fade="full"
              position={{ top: '18%', left: '50%' }}
              tag="hero"
              parallax
            />
          </ScrollYProvider>
          <AppHeader
            overlay
            subline="One club · One family"
            action={
              <HeaderPill
                icon="log-in-outline"
                label="SIGN IN"
                accessibilityLabel="Sign in"
                onPress={() => router.push('/sign-in')}
              />
            }
          />
        </View>

        <View
          style={[
            styles.column,
            { marginTop: -space.giant, maxWidth: Math.min(width, maxContentWidth + gutter * 2) },
          ]}
        >
          <Animated.View entering={enter(0)}>
            <Eyebrow>Amakhosi · One App · Concept</Eyebrow>
          </Animated.View>
          <Animated.View entering={enter(1)}>
            <Headline lead="Every Khosi" accent="matters." />
          </Animated.View>
          <Animated.View entering={enter(2)}>
            <Text variant="body" color="textSecondary" style={{ fontSize: 17, lineHeight: 27 }}>
              Club news, matchday, membership and Fan Moments in one home. For the results that test
              you, the moments that lift you, and the family that never stops.
            </Text>
          </Animated.View>
          <Animated.View entering={enter(3)} style={{ gap: space.md }}>
            <Button
              label="Create your account"
              trailingIcon="arrow-forward"
              onPress={() => router.push('/register')}
              testID="welcome-register"
            />
            <Button
              label="Browse as a guest"
              variant="secondary"
              onPress={() => {
                finish('guest');
                router.replace('/home');
              }}
              testID="welcome-guest"
            />
          </Animated.View>

          <Rule style={{ marginVertical: space.lg }} />

          <Text variant="eyebrow" color="textTertiary">
            What’s inside
          </Text>
          <View style={{ gap: space.xl }}>
            {VALUE.map(([icon, title, body]) => (
              <View key={title} style={styles.value}>
                <Ionicons name={icon} size={22} color={color.accent} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline">{title}</Text>
                  <Text variant="callout" color="textSecondary">
                    {body}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.disclaimer}>
            <DemoTag />
            <Text variant="footnote" color="textSecondary">
              Concept build for review. Content is sample content, images are concept images, and
              nothing here is live club information. Not an official Kaizer Chiefs product.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  column: { paddingHorizontal: gutter, gap: space.xl, width: '100%', alignSelf: 'center' },
  value: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  disclaimer: {
    marginTop: space.lg,
    gap: space.sm,
    padding: space.lg,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
});
