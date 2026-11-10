import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Text } from '@/components';
import { useSession } from '@/state/session';
import { color, radius, space } from '@/theme';

/**
 * Account-only content. Guests see why an account is needed and two clear
 * ways forward, never an empty screen or someone else's data.
 */
export function SignInGate({
  children,
  title,
  body,
}: {
  children: ReactNode;
  title: string;
  body: string;
}) {
  const signedIn = useSession((s) => !!s.session);
  const router = useRouter();
  if (signedIn) return <>{children}</>;
  return (
    <View style={styles.box}>
      <Ionicons name="person-circle-outline" size={30} color={color.accent} />
      <Text variant="title3">{title}</Text>
      <Text variant="callout" color="textSecondary">
        {body}
      </Text>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.push('/register')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.md,
    backgroundColor: color.bgRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
});
