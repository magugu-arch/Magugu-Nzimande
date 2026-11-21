import { quizScore } from '@scarlets/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { DemoChip, Tag } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { ModalScreen } from '@/components/Modal';
import { Press } from '@/components/Press';
import { Notice, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { useFanZone } from '@/data/queries';
import { useSubmit } from '@/features/fanzone/cards';
import { useL, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { hitTarget, radius, space, useTheme } from '@/theme';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const router = useRouter();
  const zone = useFanZone();
  const { submit, error, pending } = useSubmit();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState<{ correct: number; total: number } | null>(null);

  const activity = zone.data?.activities.data?.find((a) => a.id === id);
  if (zone.isPending) {
    return (
      <ModalScreen title={t('fan.quiz.start')}>
        <SkeletonList rows={4} />
      </ModalScreen>
    );
  }
  if (!activity || activity.kind !== 'quiz') {
    return (
      <ModalScreen title={t('fan.quiz.start')}>
        <Notice body={t('common.notFound')} />
      </ModalScreen>
    );
  }

  const question = activity.questions[index];
  const total = activity.questions.length;

  if (finished || !question) {
    const result = finished ?? quizScore(activity, answers);
    return (
      <ModalScreen
        testID="quiz-result"
        title={l(activity.title)}
        footer={
          <Button testID="quiz-done" label={t('common.done')} fill onPress={() => router.back()} />
        }
      >
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <Icon name="ribbon" size={54} color={theme.accentText} />
          <Text variant="display" align="center" numeric testID="quiz-result-score">
            {result.correct}/{result.total}
          </Text>
          <Text variant="title3" align="center">
            {t('fan.quiz.score', { score: `${result.correct}/${result.total}` })}
          </Text>
          <DemoChip />
        </View>
      </ModalScreen>
    );
  }

  const chosen = answers[question.id];
  const answered = chosen !== undefined;
  const last = index === total - 1;

  const next = async () => {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    const ok = await submit(activity.id, { kind: 'quiz', activityId: activity.id, answers });
    if (ok) {
      track('fanzone_quiz_complete', { activity_id: activity.id });
      setFinished(quizScore(activity, answers));
    }
  };

  return (
    <ModalScreen
      testID="quiz"
      title={l(activity.title)}
      footer={
        <>
          {error ? (
            <Text variant="footnote" color="warning" testID="submit-error">
              {t(`error.${error}` as MessageKey)}
            </Text>
          ) : null}
          <Button
            testID="quiz-next"
            label={last ? t('fan.quiz.finish') : t('common.next')}
            fill
            disabled={!answered}
            loading={pending}
            onPress={() => void next()}
          />
        </>
      }
    >
      <View style={{ gap: space.sm }}>
        <View
          style={{ flexDirection: 'row', gap: 6 }}
          accessible
          accessibilityLabel={t('fan.quiz.question', { n: index + 1, total })}
        >
          {activity.questions.map((q, i) => (
            <View
              key={q.id}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= index ? theme.accent : theme.surfaceMuted,
              }}
            />
          ))}
        </View>
        <Text variant="eyebrow" color="textSecondary">
          {t('fan.quiz.question', { n: index + 1, total })}
        </Text>
      </View>
      <Text variant="title1" accessibilityRole="header">
        {l(question.prompt)}
      </Text>
      <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
        {question.options.map((option) => {
          const isChosen = chosen === option.id;
          const isAnswer = option.id === question.answerId;
          // Once answered, the right answer is shown whichever was picked.
          const border = !answered
            ? theme.hairline
            : isAnswer
              ? theme.success
              : isChosen
                ? theme.warning
                : theme.hairline;
          return (
            <Press
              key={option.id}
              testID={`quiz-option-${option.id}`}
              disabled={answered}
              dimWhenDisabled={false}
              onPress={() => {
                if (isAnswer) haptic.success();
                else haptic.error();
                setAnswers({ ...answers, [question.id]: option.id });
              }}
              scaleTo={0.985}
              accessibilityRole="radio"
              accessibilityState={{ selected: isChosen }}
              accessibilityLabel={l(option.label)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                minHeight: hitTarget + 12,
                paddingHorizontal: space.lg,
                borderRadius: radius.lg,
                borderCurve: 'continuous',
                borderWidth: 2,
                borderColor: border,
                backgroundColor: theme.surface,
              }}
            >
              <Text variant="headline" style={{ flex: 1 }}>
                {l(option.label)}
              </Text>
              {answered && isAnswer ? (
                <Icon name="checkmark-circle" size={22} color={theme.success} />
              ) : null}
              {answered && isChosen && !isAnswer ? (
                <Icon name="close-circle" size={22} color={theme.warning} />
              ) : null}
            </Press>
          );
        })}
      </View>
      {answered ? (
        <View
          accessibilityLiveRegion="polite"
          aria-live="polite"
          style={{ gap: space.xs }}
          testID="quiz-feedback"
        >
          <Tag
            label={chosen === question.answerId ? t('fan.quiz.correct') : t('fan.quiz.incorrect')}
            tone={chosen === question.answerId ? 'success' : 'warning'}
          />
          <Text variant="body" color="textSecondary">
            {l(question.explanation)}
          </Text>
        </View>
      ) : null}
    </ModalScreen>
  );
}
