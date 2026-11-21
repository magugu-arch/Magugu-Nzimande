import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { useT } from '@/i18n';
import { usePrefs } from '@/state/prefs';
import { useTheme } from '@/theme';

/**
 * Five persistent destinations that match what supporters do most. Match and
 * Matchday are never behind a menu. Everything else lives under More.
 */
export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  const onboarded = usePrefs((s) => s.onboarded);

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.home') }} />
      <Tabs.Screen name="match" options={{ title: t('tab.match') }} />
      <Tabs.Screen name="matchday" options={{ title: t('tab.matchday') }} />
      <Tabs.Screen name="passport" options={{ title: t('tab.passport') }} />
      <Tabs.Screen name="fan-zone" options={{ title: t('tab.fanzone') }} />
    </Tabs>
  );
}
