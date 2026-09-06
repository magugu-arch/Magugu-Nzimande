import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { SupportTopic } from '@/types';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  OfflineState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { useSupportTopics } from '@/features/account/hooks';
import { isOfflinePending } from '@/features/system/queryPhase';
import { colors, spacing } from '@/theme';
import { a11yState } from '@/utils/a11yState';

type Category = SupportTopic['category'] | 'all';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'orders', label: 'Orders' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'payments', label: 'Payments' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'account', label: 'Account' },
];

/** Help & Support (brief §4). */
export default function HelpScreen() {
  const router = useRouter();
  const topics = useSupportTopics();

  const [category, setCategory] = useState<Category>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const list = topics.data ?? [];
    return category === 'all' ? list : list.filter((topic) => topic.category === category);
  }, [topics.data, category]);

  if (topics.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Help centre" />
        <LoadingState />
      </Screen>
    );
  }

  /*
    Between the two. A paused query is neither loading nor errored, so the
    screen fell through to its own body and drew a help centre with no help in
    it: the category chips across the top — All, Orders, Delivery, Payments,
    Rewards, Account — and under them nothing at all, then "Still stuck? Our
    team can look into your specific order and sort it out."

    Nobody is stuck on the help centre. They are stuck on something else, and
    the app has just told them there is nothing written about it.
  */
  if (isOfflinePending(topics)) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Help centre" />
        <OfflineState onRetry={() => void topics.refetch()} />
      </Screen>
    );
  }

  if (topics.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Help centre" />
        <ErrorState onRetry={() => void topics.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="help-screen">
      <ScreenHeader title="Help centre" />

      <View style={styles.filters}>
        {CATEGORIES.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={category === item.id}
            onPress={() => setCategory(item.id)}
          />
        ))}
      </View>

      <View style={styles.list}>
        {visible.map((topic) => {
          const expanded = expandedId === topic.id;
          return (
            <Card key={topic.id} padded={false} testID={`help-topic-${topic.id}`}>
              <Pressable
                onPress={() => setExpandedId(expanded ? null : topic.id)}
                accessibilityRole="button"
                {...a11yState({ expanded })}
                accessibilityLabel={topic.question}
                style={styles.question}
              >
                <Text variant="bodyMedium" style={styles.questionText}>
                  {topic.question}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>

              {expanded ? (
                <View style={styles.answer}>
                  <Text variant="body" color={colors.textSecondary}>
                    {topic.answer}
                  </Text>
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>

      <Card style={styles.contactCard}>
        <Text variant="h3">Still stuck?</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Our team can look into your specific order and sort it out.
        </Text>
        <Button
          label="Contact us"
          onPress={() => router.push('/account/contact')}
          iconLeft="chatbubbles-outline"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  list: { gap: spacing.sm },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  questionText: { flex: 1 },
  answer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  contactCard: { gap: spacing.md, marginVertical: spacing.xl },
});
