import { StyleSheet, View } from 'react-native';
import { formatDateLong } from '@/core/time/sast';
import { useProgress, useResults } from '@/data/hooks';
import {
  Card,
  Header,
  ListRow,
  Pill,
  ProgressBar,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  Text,
  colors,
  spacing,
} from '@/design';

/** Results and academic progress (brief §7). Sensitive: never cached offline. */
export default function Results() {
  const results = useResults();
  const progress = useProgress();
  return (
    <Screen
      header={<Header title="Results" largeTitle="Results & progress" eyebrow="Academics" />}
      onRefresh={() => {
        results.refetch();
        progress.refetch();
      }}
      testID="results"
    >
      <QueryState query={progress} what="your progress">
        {(p) => (
          <Card tone="navy">
            <Text variant="overline" color={colors.yellow}>
              Towards your qualification
            </Text>
            <Text variant="metric" color={colors.white}>
              {p.creditsEarned} / {p.creditsRequired}
            </Text>
            <Text variant="body" color={colors.textOnDarkMuted}>
              credits · average {p.averageMark}% ·{' '}
              {p.standing === 'good'
                ? 'good standing'
                : p.standing === 'monitor'
                  ? 'being monitored'
                  : 'at risk — talk to your faculty'}
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar
                value={p.creditsEarned / p.creditsRequired}
                tone="yellow"
                label={`${Math.round((p.creditsEarned / p.creditsRequired) * 100)}% of credits earned`}
              />
            </View>
          </Card>
        )}
      </QueryState>

      <View style={styles.section}>
        <SectionHeader title="This semester" />
        <QueryState query={results} what="your results">
          {(list) => (
            <Card padded={false} style={styles.list}>
              {list.map((r) => (
                <ListRow
                  key={r.id}
                  title={`${r.moduleTitle} · ${r.assessment}`}
                  subtitle={`${r.moduleCode}${r.publishedAt ? ` · published ${formatDateLong(r.publishedAt)}` : ''}`}
                  trailing={
                    <Row gap={spacing.sm}>
                      {r.mark !== null ? <Text variant="title3">{r.mark}%</Text> : null}
                      <Pill
                        label={
                          r.status === 'final'
                            ? 'Final'
                            : r.status === 'provisional'
                              ? 'Provisional'
                              : 'Not yet marked'
                        }
                        tone={
                          r.status === 'final'
                            ? 'success'
                            : r.status === 'provisional'
                              ? 'warning'
                              : 'neutral'
                        }
                      />
                    </Row>
                  }
                />
              ))}
            </Card>
          )}
        </QueryState>
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
          Provisional marks can still change. Your official record is the academic transcript.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
