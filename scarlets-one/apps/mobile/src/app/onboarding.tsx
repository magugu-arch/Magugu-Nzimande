import type { Locale } from '@scarlets/domain';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { CheckMark } from '@/components/Controls';
import { Photo } from '@/components/Photo';
import { Press } from '@/components/Press';
import { Text } from '@/components/Text';
import { useNotificationPreferences } from '@/data/queries';
import { useLocale, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { mediaSource } from '@/media';
import { followable, usePrefs } from '@/state/prefs';
import { MAX_CONTENT_WIDTH, hitTarget, radius, space } from '@/theme';

const STEPS = 3;

function Option({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Press
      testID={testID}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      scaleTo={0.98}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: hitTarget + 10,
        paddingHorizontal: space.lg,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: selected ? 'rgba(246,242,236,0.2)' : 'rgba(246,242,236,0.1)',
        borderWidth: 1.5,
        borderColor: selected ? '#F6F2EC' : 'rgba(246,242,236,0.22)',
      }}
    >
      <Text variant="headline" color="onInverse" style={{ flex: 1 }}>
        {label}
      </Text>
      <CheckMark checked={selected} size={24} />
    </Press>
  );
}

/**
 * First run. Three short steps, every one skippable: language, what you
 * follow, and match alerts. It asks only for what changes the next screen,
 * and says why. Marketing consent is not asked here and stays off.
 */
export default function OnboardingScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const setLocale = usePrefs((s) => s.setLocale);
  const following = usePrefs((s) => s.following);
  const toggleFollowing = usePrefs((s) => s.toggleFollowing);
  const complete = usePrefs((s) => s.completeOnboarding);
  const notifications = useNotificationPreferences();

  const finish = (alerts: boolean) => {
    const current = notifications.query.data?.data;
    if (alerts && current) notifications.update({ ...current, matchAlerts: true });
    setLocale(locale);
    complete();
    track('onboarding_complete', {
      language: locale,
      follows: following.length,
      match_alerts: alerts,
    });
    router.replace('/');
  };

  const enter = reduced ? FadeIn.duration(150) : FadeIn.duration(260);
  const exit = FadeOut.duration(120);

  return (
    <View testID="screen-onboarding" style={{ flex: 1, backgroundColor: '#191619' }}>
      <StatusBar style="light" />
      <Photo id="launch-vertical" style={StyleSheet.absoluteFill} priority decorative />
      <LinearGradient
        colors={['rgba(25,22,25,0.5)', 'rgba(25,22,25,0.2)', 'rgba(25,22,25,0.9)', '#191619']}
        locations={[0, 0.3, 0.68, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: MAX_CONTENT_WIDTH,
            paddingTop: insets.top + space.lg,
            paddingBottom: Math.max(insets.bottom, space.xl),
            paddingHorizontal: space.xl,
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 5,
                borderRadius: radius.md,
                backgroundColor: 'rgba(246,242,236,0.92)',
              }}
            >
              <Image
                source={mediaSource('crest')}
                style={{ width: 64, height: 32 }}
                contentFit="contain"
                accessibilityLabel="Scarlets"
              />
            </View>
            <Button
              testID="onboarding-skip"
              label={t('common.skip')}
              variant="outlineOnDark"
              size="sm"
              onPress={() => finish(false)}
            />
          </View>

          <View style={{ gap: space.xl }}>
            <View
              style={{ flexDirection: 'row', gap: 6 }}
              accessible
              accessibilityLabel={t('onboarding.step', { n: step + 1, total: STEPS })}
            >
              {Array.from({ length: STEPS }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: i <= step ? '#F6F2EC' : 'rgba(246,242,236,0.25)',
                  }}
                />
              ))}
            </View>

            {step === 0 ? (
              <Animated.View
                key="language"
                entering={enter}
                exiting={exit}
                style={{ gap: space.lg }}
              >
                <View style={{ gap: space.xs }}>
                  <Text variant="display" color="onInverse" accessibilityRole="header">
                    {t('onboarding.welcome')}
                  </Text>
                  <Text variant="title2" color="onInverse">
                    {t('onboarding.welcome.sub')}
                  </Text>
                  <Text variant="callout" color="goldOnInverse" style={{ fontWeight: '600' }}>
                    {t('app.tagline')} {t('app.tagline2')}
                  </Text>
                </View>
                <View style={{ gap: space.sm }}>
                  <Text variant="headline" color="onInverse">
                    {t('onboarding.language.title')}
                  </Text>
                  {(
                    [
                      ['en', 'English'],
                      ['cy', 'Cymraeg'],
                    ] as [Locale, string][]
                  ).map(([id, label]) => (
                    <Option
                      key={id}
                      testID={`language-${id}`}
                      label={label}
                      selected={locale === id}
                      onPress={() => setLocale(id)}
                    />
                  ))}
                  <Text variant="footnote" color="onInverseMuted">
                    {t('onboarding.language.body')}
                  </Text>
                </View>
              </Animated.View>
            ) : null}

            {step === 1 ? (
              <Animated.View key="follow" entering={enter} exiting={exit} style={{ gap: space.md }}>
                <Text variant="title1" color="onInverse" accessibilityRole="header">
                  {t('onboarding.follow.title')}
                </Text>
                <Text variant="callout" color="onInverseMuted">
                  {t('onboarding.follow.body')}
                </Text>
                <View style={{ gap: space.sm }}>
                  {followable.map((category) => (
                    <Option
                      key={category}
                      testID={`follow-${category}`}
                      label={t(`topic.${category}` as MessageKey)}
                      selected={following.includes(category)}
                      onPress={() => toggleFollowing(category)}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {step === 2 ? (
              <Animated.View key="alerts" entering={enter} exiting={exit} style={{ gap: space.md }}>
                <Text variant="title1" color="onInverse" accessibilityRole="header">
                  {t('onboarding.alerts.title')}
                </Text>
                <Text variant="callout" color="onInverseMuted">
                  {t('onboarding.alerts.body')}
                </Text>
              </Animated.View>
            ) : null}

            <View style={{ gap: space.sm }}>
              {step < STEPS - 1 ? (
                <Button
                  testID="onboarding-continue"
                  label={t('common.continue')}
                  fill
                  onPress={() => setStep(step + 1)}
                />
              ) : (
                <>
                  <Button
                    testID="onboarding-alerts-on"
                    label={t('onboarding.alerts.on')}
                    icon="notifications"
                    fill
                    onPress={() => finish(true)}
                  />
                  <Button
                    testID="onboarding-start"
                    label={t('onboarding.alerts.later')}
                    variant="outlineOnDark"
                    fill
                    onPress={() => finish(false)}
                  />
                </>
              )}
              <Text variant="caption" color="onInverseMuted" align="center">
                {t('concept.banner')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
