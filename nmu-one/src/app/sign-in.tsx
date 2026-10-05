import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import type { PersonaId } from '@/core/adapters/contracts';
import { isDemoData } from '@/core/adapters/registry';
import { personaDescriptions } from '@/core/fixtures/people';
import { BrandMark, Button, Chip, Notice, Photo, Row, Text, colors, spacing } from '@/design';
import { useSession } from '@/state/session';

const PERSONAS: { id: PersonaId; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'staff', label: 'Staff' },
  { id: 'parent', label: 'Parent' },
  { id: 'alumni', label: 'Alumni' },
];

/**
 * One sign-in for everything (brief §15, §26 step 1). The person never picks
 * a role: NMU SSO says who they are and the experience follows. In demo mode
 * a presenter can choose which synthetic identity the mock SSO returns.
 *
 * Legibility: no text sits on the photograph. The photo is a band at the top
 * that fades into navy; every word is set on solid navy below it (white
 * 16:1, muted 9:1, yellow 11:1), and the logo sits on its own navy plate.
 * Measured by e2e/contrast.mjs at 320–430pt wide.
 */
export default function SignIn() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const status = useSession((s) => s.status);
  const reason = useSession((s) => s.signOutReason);
  const [persona, setPersona] = useState<PersonaId>('student');
  const [failed, setFailed] = useState(false);
  const busy = status === 'signing-in';
  const { height } = useWindowDimensions();
  // The photo takes about a third of the screen, never so much that the
  // sign-in button falls below the fold on a small phone.
  const heroHeight = Math.round(Math.min(340, Math.max(170, height * 0.34)));

  const go = async () => {
    setFailed(false);
    try {
      await signIn(persona);
      router.replace('/home');
    } catch {
      setFailed(true);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { height: heroHeight + insets.top }]}>
          <Photo
            photo="heroCampus"
            size="lg"
            rounded={false}
            style={StyleSheet.absoluteFill}
            decorative
          />
          <LinearGradient
            // A light veil keeps the photo calm; the last third dissolves into
            // the navy the words are set on, so there is no hard edge.
            colors={[
              'rgba(20,28,43,0.35)',
              'rgba(20,28,43,0.05)',
              'rgba(20,28,43,0.6)',
              colors.navy,
            ]}
            locations={[0, 0.35, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.brand, { paddingTop: insets.top + spacing.lg }]}>
            <View style={styles.plate}>
              <BrandMark tone="onDark" size="sm" />
            </View>
          </View>
        </View>

        <View style={styles.statement}>
          <Text variant="overline" color={colors.yellow}>
            Nelson Mandela University
          </Text>
          <Text variant="display" color={colors.white} accessibilityRole="header">
            One campus.{'\n'}One sign-in.
          </Text>
          <Text variant="bodyLarge" color={colors.textOnDarkMuted}>
            Your classes, fees, campus and community — in one place, from your first day to long
            after graduation.
          </Text>
        </View>

        <View style={styles.actions}>
          {reason === 'expired' ? (
            <Notice
              tone="warning"
              title="Your session ended"
              body="For your security you were signed out. Sign in again to carry on."
            />
          ) : null}
          {failed ? (
            <Notice
              tone="danger"
              title="Sign-in didn’t complete"
              body="NMU SSO didn’t respond. Check your connection and try again."
            />
          ) : null}

          <Button
            label={busy ? 'Verifying with NMU SSO…' : 'Continue with NMU Single Sign-On'}
            icon="shield-checkmark"
            variant="accent"
            fullWidth
            loading={busy}
            onPress={go}
            testID="sso-sign-in"
            accessibilityHint="Signs you in with your NMU account"
          />
          <Text variant="caption" color={colors.textOnDarkMuted} align="center">
            Students, staff, families and alumni all use the same sign-in.
          </Text>

          {isDemoData() ? (
            <View style={styles.demo} testID="demo-personas">
              <Text variant="overline" color={colors.textOnDarkMuted}>
                Demo mode · sign in as
              </Text>
              <Row wrap gap={spacing.sm}>
                {PERSONAS.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.label}
                    selected={p.id === persona}
                    onPress={() => setPersona(p.id)}
                    testID={`persona-${p.id}`}
                  />
                ))}
              </Row>
              <Text variant="caption" color={colors.textOnDarkMuted}>
                {personaDescriptions[persona]} · synthetic data
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  content: { flexGrow: 1, gap: spacing.xl },
  hero: { width: '100%', backgroundColor: colors.navy, overflow: 'hidden' },
  brand: { paddingHorizontal: spacing.gutter, alignItems: 'flex-start' },
  plate: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.navy,
  },
  statement: { gap: spacing.md, paddingHorizontal: spacing.gutter, marginTop: -spacing.lg },
  actions: { gap: spacing.md, paddingHorizontal: spacing.gutter, marginTop: 'auto' },
  demo: {
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.borderOnDark,
  },
});
