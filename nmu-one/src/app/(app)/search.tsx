import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SERVICES } from '@/content/services';
import { providers } from '@/core/adapters/registry';
import {
  answerQuestion,
  SUGGESTED_QUESTIONS,
  type AssistantAnswer,
  type AssistantLink,
} from '@/core/assistant/assistant';
import { decide } from '@/core/permissions/policy';
import { clock } from '@/core/time/clock';
import { formatAgo } from '@/core/time/sast';
import { useCampusMap, useDirectory, useEvents, useWellbeingServices } from '@/data/hooks';
import {
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  ListRow,
  Row,
  Screen,
  SearchField,
  SectionHeader,
  Skeleton,
  Text,
  colors,
  radius,
  spacing,
} from '@/design';
import { useCan, useSubject } from '@/features/access/access';
import { KIND_TITLES, search, type ResultKind } from '@/features/search/searchIndex';
import { preferences, usePrefs } from '@/state/preferences';
import { useSession } from '@/state/session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Search and the assistant (brief §6). Typing searches people, places,
 * services, events and help instantly; asking (return key) gets a grounded
 * answer with its source and a next action — or a hand-off to a person.
 */
export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const subject = useSubject();
  const prefs = usePrefs(user?.id);
  const canDirectory = useCan('directory.view');
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');

  const map = useCampusMap();
  const directory = useDirectory();
  const events = useEvents();
  const wellbeing = useWellbeingServices();
  const knowledge = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => providers.support.getKnowledge(),
    staleTime: 10 * 60_000,
  });

  const results = useMemo(() => {
    if (!query.trim() || !subject) return null;
    return search(query, {
      services: SERVICES.filter((s) => decide(subject, s.capability).allowed),
      buildings: map.data?.buildings ?? [],
      people: canDirectory ? (directory.data ?? []) : [],
      events: events.data ?? [],
      articles: (knowledge.data ?? []).filter((a) => role && a.roles.includes(role)),
      wellbeing: wellbeing.data ?? [],
    });
  }, [
    query,
    subject,
    map.data,
    directory.data,
    events.data,
    knowledge.data,
    wellbeing.data,
    canDirectory,
    role,
  ]);

  const answer = useQuery({
    queryKey: ['assistant', user?.id, role, asked],
    enabled: !!asked && !!subject && !!user && !!role,
    staleTime: 0,
    gcTime: 0,
    queryFn: () =>
      answerQuestion(asked, {
        role: role!,
        givenName: user!.givenName,
        now: clock.now(),
        decide: (c) => decide(subject!, c),
        data: {
          map: () => providers.campus.getMap(),
          account: () => providers.finance.getAccount(),
          funding: () => providers.finance.getFunding(),
          studySpaces: (day) => providers.library.getStudySpaces(day),
          arrivals: () => providers.transport.getArrivals(),
          routes: () => providers.transport.getRoutes(),
          timetable: (r) => providers.academic.getTimetable(r),
          exams: () => providers.academic.getExams(),
          knowledge: () => providers.support.getKnowledge(),
          supportRoutes: () => providers.support.getSupportRoutes(),
        },
      }),
  });

  const ask = (q: string) => {
    const t = q.trim();
    if (!t) return;
    setQuery(t);
    setAsked(t);
    if (user) preferences.addRecentSearch(user.id, t);
  };

  const go = (link: AssistantLink) => {
    if (link.href.startsWith('tel:')) void Linking.openURL(link.href);
    else router.push(link.href as Href);
  };

  const hasResults = results && Object.values(results).some((r) => r.length > 0);

  return (
    <Screen
      header={
        <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <SearchField
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                if (!t) setAsked('');
              }}
              onSubmitEditing={() => ask(query)}
              onClear={() => {
                setQuery('');
                setAsked('');
              }}
              label="Search or ask NMU ONE"
              autoFocus
              testID="search-input"
            />
          </View>
          <IconButton
            icon="close"
            label="Close search"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          />
        </View>
      }
      testID="search"
    >
      {!query ? (
        <View style={{ gap: spacing.xl }}>
          <View>
            <SectionHeader title="Try asking" />
            <Row wrap gap={spacing.sm}>
              {(role ? SUGGESTED_QUESTIONS[role] : []).map((q) => (
                <Chip
                  key={q}
                  label={q}
                  icon="sparkles-outline"
                  onPress={() => ask(q)}
                  testID={`suggest-${q}`}
                />
              ))}
            </Row>
          </View>
          {prefs.recentSearches.length ? (
            <View>
              <SectionHeader
                title="Recent"
                action="Clear"
                onAction={() => user && preferences.clearRecentSearches(user.id)}
              />
              <Card padded={false} style={styles.list}>
                {prefs.recentSearches.map((r) => (
                  <ListRow key={r} icon="time-outline" title={r} onPress={() => ask(r)} />
                ))}
              </Card>
            </View>
          ) : null}
          <Text variant="caption" color={colors.textSecondary}>
            Answers come only from NMU services and approved help content, with their source. When
            there’s no approved answer, you’ll be pointed to a person who can help.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.xl }}>
          {asked ? (
            answer.isLoading || !answer.data ? (
              <Card testID="answer-loading">
                <View style={{ gap: spacing.sm }} accessibilityLabel="Finding an answer" accessible>
                  <Skeleton height={14} width="30%" />
                  <Skeleton height={18} width="95%" />
                  <Skeleton height={18} width="80%" />
                </View>
              </Card>
            ) : (
              <AnswerCard answer={answer.data} onAction={go} />
            )
          ) : (
            <Button
              label={`Ask: “${query}”`}
              icon="sparkles"
              variant="secondary"
              fullWidth
              onPress={() => ask(query)}
              testID="ask-button"
            />
          )}

          {results && hasResults ? (
            (Object.keys(results) as ResultKind[])
              .filter((k) => results[k].length)
              .map((k) => (
                <View key={k}>
                  <SectionHeader title={KIND_TITLES[k]} />
                  <Card padded={false} style={styles.list}>
                    {results[k].map((r) => (
                      <ListRow
                        key={`${r.kind}-${r.id}`}
                        icon={r.icon}
                        title={r.title}
                        subtitle={r.subtitle}
                        onPress={() => router.push(r.href)}
                        testID={`result-${r.kind}-${r.id}`}
                      />
                    ))}
                  </Card>
                </View>
              ))
          ) : !asked ? (
            <Text variant="body" color={colors.textSecondary}>
              No matches yet — press return to ask instead.
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function AnswerCard({
  answer,
  onAction,
}: {
  answer: AssistantAnswer;
  onAction: (l: AssistantLink) => void;
}) {
  const tone = answer.kind === 'answer' ? styles.answer : styles.answerMuted;
  return (
    <View style={[styles.card, tone]} testID="assistant-answer" accessibilityLiveRegion="polite">
      <Row gap={spacing.sm}>
        <Icon
          name={
            answer.kind === 'handoff'
              ? 'people'
              : answer.kind === 'denied'
                ? 'lock-closed'
                : 'sparkles'
          }
          size={18}
          color={colors.navy2}
        />
        <Text variant="overline" color={colors.textSecondary}>
          {answer.kind === 'handoff'
            ? 'Let’s get you to a person'
            : answer.kind === 'denied'
              ? 'Not available to you'
              : answer.kind === 'unavailable'
                ? 'Service unavailable'
                : 'Answer'}
        </Text>
      </Row>
      <Text variant="bodyLarge" testID="assistant-text">
        {answer.text}
      </Text>
      {answer.source ? (
        <Text variant="caption" color={colors.textSecondary}>
          Source: {answer.source.label}
          {answer.source.updatedAt
            ? ` · updated ${formatAgo(answer.source.updatedAt, clock.now()).toLowerCase()}`
            : ''}
        </Text>
      ) : null}
      {answer.action || answer.secondary ? (
        <Row gap={spacing.sm} wrap style={{ marginTop: spacing.xs }}>
          {answer.action ? (
            <Button
              label={answer.action.label}
              variant="accent"
              size="md"
              onPress={() => onAction(answer.action!)}
              testID="assistant-action"
            />
          ) : null}
          {answer.secondary ? (
            <Button
              label={answer.secondary.label}
              variant="secondary"
              size="md"
              onPress={() => onAction(answer.secondary!)}
            />
          ) : null}
        </Row>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  list: { paddingHorizontal: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  answer: { backgroundColor: colors.surface, borderLeftWidth: 5, borderLeftColor: colors.yellow },
  answerMuted: {
    backgroundColor: colors.surface,
    borderLeftWidth: 5,
    borderLeftColor: colors.navy2,
  },
});
