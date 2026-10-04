import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDayLong } from '@/core/time/sast';
import { useStudentProfile } from '@/data/hooks';
import {
  Button,
  Card,
  HeroBack,
  Icon,
  Notice,
  PhotoHero,
  Row,
  Screen,
  Sheet,
  Text,
  colors,
  spacing,
  type IconName,
} from '@/design';
import { isDemoData } from '@/core/adapters/registry';
import { useSession } from '@/state/session';

const CHANGES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'finger-print', title: 'Same sign-in, same you', body: 'No new account. NMU ONE moves with you from student to alumni.' },
  { icon: 'home', title: 'A new Home', body: 'Mentoring, careers, alumni events and giving take the place of timetables and fees.' },
  { icon: 'people', title: 'A community that stays', body: 'Your chapter, your classmates, and students who could use your advice.' },
];

/**
 * Student → Graduate → Alumni (brief §14, §26 step 12). The relationship
 * changes shape; it does not end, and nobody has to start again.
 */
export default function Graduation() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const graduate = useSession((s) => s.graduate);
  const profile = useStudentProfile();
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const ceremony = profile.data?.graduation.ceremony;

  const go = async () => {
    setWorking(true);
    setFailed(false);
    try {
      await graduate();
      setConfirm(false);
      router.replace('/home');
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen padded={false} topInset={false} testID="graduation">
      <PhotoHero
        photo="graduation"
        eyebrow={ceremony ? `Graduation · ${formatDayLong(ceremony)}` : 'Graduation'}
        title={`Congratulations, ${user?.givenName ?? ''}`}
        subtitle={profile.data ? `${profile.data.qualification} · ${profile.data.graduation.venue ?? ''}` : undefined}
        height={340}
        topBar={<HeroBack />}
      />
      <View style={styles.body}>
        <Text variant="title2" accessibilityRole="header">
          What happens to NMU ONE
        </Text>
        <View style={{ gap: spacing.md }}>
          {CHANGES.map((c) => (
            <Card key={c.title}>
              <Row gap={spacing.md} align="flex-start">
                <View style={styles.icon}>
                  <Icon name={c.icon} size={20} color={colors.navy} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{c.title}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {c.body}
                  </Text>
                </View>
              </Row>
            </Card>
          ))}
        </View>
        {failed ? <Notice tone="danger" title="That didn’t complete" body="Nothing has changed. Please try again." /> : null}
        <Button label="Continue as alumni" icon="school" variant="accent" fullWidth onPress={() => setConfirm(true)} testID="continue-as-alumni" />
        <Button label="Not yet" variant="ghost" fullWidth onPress={() => router.back()} />
      </View>

      <Sheet visible={confirm} onClose={() => !working && setConfirm(false)} title="Move to your alumni experience?" testID="graduation-sheet">
        <Text variant="body">
          Your sign-in stays the same. Home, services and notifications will switch to alumni ones.
        </Text>
        {isDemoData() ? (
          <Text variant="caption" color={colors.textSecondary}>
            Demo: in the live service this happens automatically once your qualification is conferred.
          </Text>
        ) : null}
        <Button label="Yes, continue as alumni" variant="accent" fullWidth loading={working} onPress={go} testID="confirm-alumni" />
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConfirm(false)} disabled={working} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter, gap: spacing.lg },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
});
