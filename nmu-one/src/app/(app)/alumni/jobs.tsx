import { View } from 'react-native';
import { isDemoData } from '@/core/adapters/registry';
import { formatAgo } from '@/core/time/sast';
import { useJobs } from '@/data/hooks';
import {
  Card,
  Header,
  Pill,
  QueryState,
  Row,
  Screen,
  StateView,
  Text,
  colors,
  spacing,
} from '@/design';
import { useNow } from '@/features/system/useNow';

const TYPE = {
  'full-time': 'Full-time',
  'graduate-programme': 'Graduate programme',
  contract: 'Contract',
  internship: 'Internship',
} as const;

/** Careers (brief §14 "job board / careers"): roles shared through the alumni network. */
export default function Jobs() {
  const jobs = useJobs();
  const now = useNow();
  return (
    <Screen
      header={
        <Header
          title="Careers"
          largeTitle="Careers & jobs"
          eyebrow="Alumni"
          subtitle="Roles shared by alumni and partner employers."
        />
      }
      testID="jobs"
    >
      <QueryState
        query={jobs}
        what="jobs"
        isEmpty={(j) => j.length === 0}
        empty={<StateView kind="empty" title="No roles listed right now" />}
      >
        {(list) => (
          <View style={{ gap: spacing.md }}>
            {list.map((j) => (
              <Card key={j.id}>
                <Row justify="space-between" align="flex-start">
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title3">{j.title}</Text>
                    <Text variant="body">{j.organisation}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {j.location} · posted {formatAgo(j.postedAt, now).toLowerCase()}
                    </Text>
                  </View>
                  <Pill label={TYPE[j.type]} tone="info" />
                </Row>
              </Card>
            ))}
            <Text variant="caption" color={colors.textSecondary}>
              Applications are made with the employer.
              {isDemoData() ? ' Demo listings use fictional organisations.' : ''}
            </Text>
          </View>
        )}
      </QueryState>
    </Screen>
  );
}
