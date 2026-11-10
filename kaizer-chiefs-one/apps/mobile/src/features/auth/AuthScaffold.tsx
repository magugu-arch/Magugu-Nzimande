import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader, DemoTag, Eyebrow, Headline, Text } from '@/components';
import { color, gutter, maxContentWidth, space } from '@/theme';
import { anyDemo } from '@kc-one/contracts';
import { capabilities } from '@/config/env';

export function AuthScaffold({
  eyebrow,
  lead,
  accent,
  intro,
  children,
}: {
  eyebrow: string;
  lead: string;
  accent?: string;
  intro?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BackHeader />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
      >
        <Eyebrow>{eyebrow}</Eyebrow>
        <Headline lead={lead} accent={accent} size="display" />
        {intro ? (
          <Text variant="body" color="textSecondary">
            {intro}
          </Text>
        ) : null}
        {anyDemo(capabilities) ? (
          <View style={styles.demo}>
            <DemoTag />
            <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
              Demo sign-in. Your details are checked against the real rules, then a local demo
              session starts. No account is created and no password is stored.
            </Text>
          </View>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  content: {
    paddingHorizontal: gutter,
    paddingTop: space.lg,
    gap: space.xl,
    width: '100%',
    maxWidth: maxContentWidth + gutter * 2,
    alignSelf: 'center',
  },
  demo: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: 8,
    backgroundColor: color.bgRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
});
