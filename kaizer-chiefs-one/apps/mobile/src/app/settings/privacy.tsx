import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackHeader, Button, Group, ListRow, Screen, Text, ToggleRow } from '@/components';
import { usePreferences } from '@/state/preferences';
import { space } from '@/theme';

/**
 * Privacy choices, all off until the supporter turns them on. Designed for
 * review against POPIA by the club's privacy team.
 */
export default function Privacy() {
  const router = useRouter();
  const privacy = usePreferences((s) => s.privacy);
  const setPrivacy = usePreferences((s) => s.setPrivacy);
  return (
    <Screen topInset={false} header={<BackHeader title="Privacy" />}>
      <View style={{ gap: space.xl }}>
        <Text variant="body" color="textSecondary">
          You decide what the club may use beyond running your account. Change any of these at any
          time; changes apply from now on.
        </Text>
        <Text variant="eyebrow" color="textTertiary">
          Marketing
        </Text>
        <Group>
          <ToggleRow
            title="Email from the club"
            description="News, offers and campaigns."
            value={privacy.marketingEmail}
            onValueChange={(v) => setPrivacy({ marketingEmail: v })}
          />
          <ToggleRow
            title="SMS from the club"
            description="Occasional offers by text message."
            value={privacy.marketingSms}
            onValueChange={(v) => setPrivacy({ marketingSms: v })}
          />
        </Group>
        <Text variant="eyebrow" color="textTertiary">
          Your experience
        </Text>
        <Group>
          <ToggleRow
            title="Personalised content"
            description="Use what you read and follow to order stories for you."
            value={privacy.personalisedContent}
            onValueChange={(v) => setPrivacy({ personalisedContent: v })}
          />
          <ToggleRow
            title="Product analytics"
            description="Anonymous usage data that helps improve the app. Never includes your name, email or member number."
            value={privacy.productAnalytics}
            onValueChange={(v) => setPrivacy({ productAnalytics: v })}
          />
          <ToggleRow
            title="Show my name on Fan Moments"
            description="The default for new moments. You can change it on each one."
            value={privacy.showNameOnFanMoments}
            onValueChange={(v) => setPrivacy({ showNameOnFanMoments: v })}
          />
        </Group>
        <Text variant="eyebrow" color="textTertiary">
          Your data
        </Text>
        <Group>
          <ListRow
            icon="download-outline"
            title="Request a copy of your data"
            onPress={() => router.push('/settings/account')}
          />
          <ListRow
            icon="trash-outline"
            title="Delete your account"
            destructive
            onPress={() => router.push('/settings/account')}
          />
        </Group>
        <Button
          label="Read the privacy notice"
          variant="secondary"
          onPress={() => router.push('/legal/privacy')}
        />
      </View>
    </Screen>
  );
}
