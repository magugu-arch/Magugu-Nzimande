import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eyebrow, Text } from '@/components';
import { color, gutter, space } from '@/theme';

/**
 * Shown instead of the app when the build configuration is invalid, for
 * example a production build with a demo adapter switched on. Lists variable
 * names and problems only, never values.
 */
export function ConfigErrorScreen({ problems }: { problems: string[] }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.lg }}>
        <Eyebrow>Configuration</Eyebrow>
        <Text variant="title1">This build is not configured correctly</Text>
        <Text variant="body" color="textSecondary">
          The app will not start with demo content or missing settings in this environment. Fix the
          build configuration and rebuild.
        </Text>
        <View style={{ gap: space.sm }}>
          {problems.map((p) => (
            <Text
              key={p}
              variant="footnote"
              color="text"
              style={{ fontFamily: 'DMMono_400Regular' }}
            >
              • {p}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
