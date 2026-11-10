import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackHeader, Group, ListRow, Notice, Screen, Text } from '@/components';
import { space } from '@/theme';

const FAQ = [
  [
    'Where do fixtures and scores come from?',
    'From the club’s licensed match data provider. If the feed is late or offline, the app says so rather than guessing.',
  ],
  [
    'Why can’t I screenshot my ticket?',
    'Entry codes are issued at the moment you show them and expire within minutes, which protects you from ticket fraud.',
  ],
  [
    'Who sees my Fan Moments?',
    'Only you, until a moderator approves them. You can remove a moment at any time unless it is held for a safeguarding review.',
  ],
  [
    'How do I change what the club sends me?',
    'Profile → Notification preferences, and Profile → Privacy for email and SMS.',
  ],
] as const;

export default function Help() {
  const router = useRouter();
  return (
    <Screen topInset={false} header={<BackHeader title="Help and contact" />}>
      <View style={{ gap: space.xl }}>
        <Text variant="eyebrow" color="textTertiary">
          Common questions
        </Text>
        <View style={{ gap: space.lg }}>
          {FAQ.map(([q, a]) => (
            <View key={q} style={{ gap: space.xs }}>
              <Text variant="headline">{q}</Text>
              <Text variant="callout" color="textSecondary">
                {a}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="eyebrow" color="textTertiary">
          Contact
        </Text>
        <Notice
          compact
          reason="integration_pending"
          title="Support contacts pending"
          body="Ticketing, membership and app support contacts are added once the club confirms its support channels."
        />
        <Group>
          <ListRow
            icon="document-text-outline"
            title="Terms of use"
            onPress={() => router.push('/legal/terms')}
          />
          <ListRow
            icon="lock-closed-outline"
            title="Privacy notice"
            onPress={() => router.push('/legal/privacy')}
          />
          <ListRow
            icon="people-outline"
            title="Community rules"
            onPress={() => router.push('/legal/community')}
          />
        </Group>
      </View>
    </Screen>
  );
}
