import { View } from 'react-native';
import Constants from 'expo-constants';
import { config } from '@/core/config';
import { isDemoData } from '@/core/adapters/registry';
import { standInSlots } from '@/content/photos';
import { Card, Divider, Header, Notice, Row, Screen, Text, colors, spacing } from '@/design';

/**
 * About this build. In demo mode it says so plainly (brief §8: synthetic data
 * is labelled in configuration — and, here, for anyone who asks).
 */
export default function About() {
  const rows: [string, string][] = [
    ['Version', Constants.expoConfig?.version ?? '0.1.0'],
    ['Data', isDemoData() ? 'Synthetic demo data' : 'Live NMU services'],
    ['Clock', config.clock === 'scenario' ? 'Demo scenario (09:40 start)' : 'Device time'],
    [
      'Integrations',
      config.dataMode === 'live' ? (config.bffBaseUrl ?? 'BFF not configured') : 'Mock adapters',
    ],
  ];
  return (
    <Screen
      header={
        <Header
          title="About"
          largeTitle="About NMU ONE"
          eyebrow="Settings"
          fallbackHref="/profile"
        />
      }
      testID="about"
    >
      <Text variant="bodyLarge" style={{ marginBottom: spacing.lg }}>
        NMU ONE is Nelson Mandela University’s digital campus: one sign-in for classes, money,
        campus life, community and alumni.
      </Text>
      {isDemoData() ? (
        <Notice
          tone="warning"
          title="This is a demonstration build"
          body="Every name, balance, timetable and notice here is invented. No NMU system is connected, and nothing you do here reaches the university."
        />
      ) : null}
      <Card style={{ marginTop: spacing.lg }}>
        {rows.map(([k, v], i) => (
          <View key={k}>
            {i > 0 ? <Divider /> : null}
            <Row justify="space-between" style={{ paddingVertical: spacing.md, gap: spacing.lg }}>
              <Text variant="body" color={colors.textSecondary}>
                {k}
              </Text>
              <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
                {v}
              </Text>
            </Row>
          </View>
        ))}
      </Card>
      {isDemoData() && standInSlots.length ? (
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.lg }}>
          Photography: {standInSlots.length} image slot(s) use a stand-in until the final photograph
          is supplied.
        </Text>
      ) : null}
    </Screen>
  );
}
