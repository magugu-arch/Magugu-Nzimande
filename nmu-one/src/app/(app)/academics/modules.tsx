import { View } from 'react-native';
import { useModules, useLmsLinks } from '@/data/hooks';
import {
  Card,
  Header,
  ListRow,
  Pill,
  ProgressBar,
  QueryState,
  Row,
  Screen,
  Text,
  colors,
  spacing,
} from '@/design';

/** Modules and LMS deep links (brief §7). */
export default function Modules() {
  const modules = useModules();
  return (
    <Screen
      header={<Header title="Modules" largeTitle="Your modules" eyebrow="Academics" />}
      testID="modules"
    >
      <QueryState query={modules} what="your modules">
        {(list) => (
          <View style={{ gap: spacing.md }}>
            {list.map((m) => (
              <Card key={m.code}>
                <Row justify="space-between">
                  <Text variant="overline" color={colors.textSecondary}>
                    {m.code} · {m.credits} credits
                  </Text>
                  <Pill label={m.semester === 'year' ? 'Year module' : `Semester ${m.semester}`} />
                </Row>
                <Text variant="title3">{m.title}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {m.lecturer}
                </Text>
                <View style={{ marginVertical: spacing.sm, gap: spacing.xs }}>
                  <ProgressBar
                    value={m.progress}
                    label={`${Math.round(m.progress * 100)}% of scheduled work complete`}
                  />
                  <Text variant="caption" color={colors.textSecondary}>
                    {Math.round(m.progress * 100)}% of the semester’s work done
                  </Text>
                </View>
                <ModuleLinks code={m.code} />
              </Card>
            ))}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

function ModuleLinks({ code }: { code: string }) {
  const links = useLmsLinks(code);
  const first = links.data?.[0];
  if (!first) return null;
  return (
    <ListRow
      icon="laptop-outline"
      title="Open on the LMS"
      subtitle={
        first.url
          ? 'Course page, recordings and submissions'
          : 'Available once the LMS is connected'
      }
      disabled={!first.url}
      trailing={first.url ? undefined : <Pill label="Not connected" />}
    />
  );
}
