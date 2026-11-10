import { View } from 'react-native';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_COPY } from '@kc-one/contracts';
import { BackHeader, Group, Notice, Screen, Text, ToggleRow } from '@/components';
import { capabilities } from '@/config/env';
import { usePreferences } from '@/state/preferences';
import { space } from '@/theme';

/**
 * Notification preferences. Everything optional starts off. Campaigns are only
 * ever sent to supporters who opted in to that category.
 */
export default function NotificationSettings() {
  const prefs = usePreferences((s) => s.notifications);
  const setPush = usePreferences((s) => s.setPush);
  const setCategory = usePreferences((s) => s.setCategory);
  return (
    <Screen topInset={false} header={<BackHeader title="Notification preferences" />}>
      <View style={{ gap: space.xl }}>
        {capabilities.notifications !== 'live' ? (
          <Notice
            compact
            reason="integration_pending"
            title="Push delivery not connected"
            body="Your choices are saved now and used once the club connects push notifications."
          />
        ) : null}
        <Group>
          <ToggleRow
            title="Allow push notifications"
            description="You can also turn these off in your phone’s settings."
            value={prefs.pushEnabled}
            onValueChange={setPush}
          />
        </Group>
        <Text variant="eyebrow" color="textTertiary">
          What you hear about
        </Text>
        <Group>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <ToggleRow
              key={c}
              title={NOTIFICATION_CATEGORY_COPY[c].label}
              description={NOTIFICATION_CATEGORY_COPY[c].description}
              value={prefs.categories[c] ?? false}
              disabled={!NOTIFICATION_CATEGORY_COPY[c].optional || !prefs.pushEnabled}
              onValueChange={(v) => setCategory(c, v)}
            />
          ))}
        </Group>
      </View>
    </Screen>
  );
}
