import type { FanZonePayload } from '@scarlets/api-client';
import {
  activityWindow,
  formatVenueTime,
  type ChallengeActivity,
  type FanActivity,
  type FanCamActivity,
  type PollActivity,
  type PredictionActivity,
  type QuizActivity,
  type Receipt,
  type SubmitError,
} from '@scarlets/domain';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DemoChip, PlacementTag, Tag } from '@/components/Chips';
import { CheckMark, Stepper } from '@/components/Controls';
import { Icon, type IconName } from '@/components/Icon';
import { Press } from '@/components/Press';
import { Text } from '@/components/Text';
import { useNow, useSubmitFanActivity, useWithdrawSubmission } from '@/data/queries';
import { useL, useLocale, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { springs, useReducedMotion } from '@/lib/motion';
import { useSession } from '@/state/session';
import { hitTarget, radius, space, useTheme } from '@/theme';

const receiptFor = (receipts: readonly Receipt[], activityId: string) =>
  receipts.find((r) => r.activityId === activityId && r.moderation !== 'withdrawn');

/** Submit with the right feedback: a success or error haptic on the frame the answer lands. */
export function useSubmit() {
  const mutation = useSubmitFanActivity();
  const [error, setError] = useState<SubmitError | null>(null);
  const submit = async (activityId: string, input: unknown): Promise<boolean> => {
    setError(null);
    const result = await mutation.mutateAsync({ activityId, input });
    if (result.ok) {
      haptic.success();
      return true;
    }
    haptic.error();
    setError(result.error);
    return false;
  };
  return { submit, error, pending: mutation.isPending };
}

function Shell({
  activity,
  icon,
  children,
  testID,
}: {
  activity: FanActivity;
  icon: IconName;
  children: ReactNode;
  testID: string;
}) {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const theme = useTheme();
  const now = useNow(15_000);
  const window = activityWindow(activity, now);
  const stamp = (iso: string) => {
    const at = formatVenueTime(iso, 'Europe/London', locale);
    return `${at.date}, ${at.time}`;
  };
  // Long-running activities do not need a date; ones tied to a fixture do.
  const dated = Boolean(activity.fixtureId);
  return (
    <Card testID={testID} style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: theme.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={22} color={theme.accentText} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="title3" accessibilityRole="header">
            {l(activity.title)}
          </Text>
          <Text variant="callout" color="textSecondary">
            {l(activity.prompt)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tag
          label={
            window === 'open'
              ? t('fan.open')
              : window === 'closed'
                ? t('fan.closed')
                : t('fan.upcoming')
          }
          tone={window === 'open' ? 'success' : 'neutral'}
          icon={
            window === 'open'
              ? 'radio-button-on'
              : window === 'closed'
                ? 'lock-closed'
                : 'time-outline'
          }
        />
        {dated && window === 'open' ? (
          <Text variant="caption" color="textSecondary" numeric>
            {t('fan.closes', { when: stamp(activity.closesAt) })}
          </Text>
        ) : null}
        {dated && window === 'upcoming' ? (
          <Text variant="caption" color="textSecondary" numeric>
            {t('fan.opens', { when: stamp(activity.opensAt) })}
          </Text>
        ) : null}
        {activity.sponsorship ? <PlacementTag label="sponsored" /> : null}
        <DemoChip />
      </View>
      {children}
    </Card>
  );
}

function ErrorLine({ error }: { error: SubmitError | null }) {
  const t = useT();
  if (!error) return null;
  return (
    <Text
      variant="footnote"
      color="warning"
      accessibilityLiveRegion="polite"
      aria-live="polite"
      testID="submit-error"
    >
      {t(`error.${error}` as MessageKey)}
    </Text>
  );
}

export function PredictionCard({
  activity,
  receipts,
}: {
  activity: PredictionActivity;
  receipts: Receipt[];
}) {
  const t = useT();
  const now = useNow(15_000);
  const [home, setHome] = useState(20);
  const [away, setAway] = useState(17);
  const { submit, error, pending } = useSubmit();
  const mine = receiptFor(receipts, activity.id);
  const window = activityWindow(activity, now);
  return (
    <Shell activity={activity} icon="stats-chart" testID="activity-prediction">
      {mine ? (
        <View testID="prediction-receipt" style={{ gap: 2 }}>
          <Text variant="eyebrow" color="textSecondary">
            {t('fan.prediction.yours')}
          </Text>
          <Text variant="score" numeric>
            {mine.summary.replace('-', '–')}
          </Text>
        </View>
      ) : window !== 'open' ? (
        <Text variant="callout" color="textSecondary">
          {window === 'closed' ? t('fan.prediction.closed') : t('fan.upcoming')}
        </Text>
      ) : (
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.sm }}>
            <Stepper
              testID="predict-home"
              label={activity.homeName}
              value={home}
              onChange={setHome}
              max={150}
              moreLabel={t('fan.prediction.more', { team: activity.homeName })}
              lessLabel={t('fan.prediction.less', { team: activity.homeName })}
            />
            <Stepper
              testID="predict-away"
              label={activity.awayName}
              value={away}
              onChange={setAway}
              max={150}
              moreLabel={t('fan.prediction.more', { team: activity.awayName })}
              lessLabel={t('fan.prediction.less', { team: activity.awayName })}
            />
          </View>
          <Button
            testID="predict-submit"
            label={t('fan.prediction.cta')}
            fill
            loading={pending}
            onPress={async () => {
              const ok = await submit(activity.id, {
                kind: 'prediction',
                activityId: activity.id,
                home,
                away,
              });
              if (ok) track('fanzone_prediction_submit', { activity_id: activity.id });
            }}
          />
        </View>
      )}
      <ErrorLine error={error} />
    </Shell>
  );
}

function ResultBar({ percent, mine }: { percent: number; mine: boolean }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(reduced ? percent / 100 : withSpring(percent / 100, springs.settle));
  }, [percent, progress, reduced]);
  // Scale, not width: the bar grows on the compositor without relayout.
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.001, progress.value) }],
  }));
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: 8,
            borderRadius: 4,
            backgroundColor: mine ? theme.accent : theme.textSecondary,
            opacity: mine ? 1 : 0.5,
            transformOrigin: 'left center',
          },
          style,
        ]}
      />
    </View>
  );
}

export function PollCard({
  activity,
  receipts,
  results,
}: {
  activity: PollActivity;
  receipts: Receipt[];
  results: FanZonePayload['results'][string] | undefined;
}) {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const now = useNow(15_000);
  const [choice, setChoice] = useState<string | null>(null);
  const { submit, error, pending } = useSubmit();
  const mine = receiptFor(receipts, activity.id);
  const window = activityWindow(activity, now);
  const votedId = mine?.submission.kind === 'poll' ? mine.submission.optionId : null;
  const showResults = Boolean(mine) || window === 'closed';
  const total = results?.reduce((sum, r) => sum + r.votes, 0) ?? 0;

  return (
    <Shell
      activity={activity}
      icon={activity.id.startsWith('potm') ? 'trophy' : 'megaphone'}
      testID={`activity-poll-${activity.id}`}
    >
      {showResults ? (
        <View style={{ gap: space.md }} testID="poll-results">
          {activity.options.map((option) => {
            const row = results?.find((r) => r.optionId === option.id);
            const isMine = option.id === votedId;
            return (
              <View
                key={option.id}
                accessible
                accessibilityLabel={`${l(option.label)}: ${row?.percent ?? 0}%${isMine ? `. ${t('fan.voted')}` : ''}`}
                style={{ gap: 5 }}
              >
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}
                >
                  <Text variant="callout" style={{ flex: 1, fontWeight: isMine ? '700' : '400' }}>
                    {l(option.label)}
                    {isMine ? '  ✓' : ''}
                  </Text>
                  <Text variant="callout" numeric style={{ fontWeight: '600' }}>
                    {row?.percent ?? 0}%
                  </Text>
                </View>
                <ResultBar percent={row?.percent ?? 0} mine={isMine} />
              </View>
            );
          })}
          <Text variant="caption" color="textSecondary" numeric>
            {t('fan.results')} · {t('fan.votes', { n: total.toLocaleString('en-GB') })}
          </Text>
        </View>
      ) : window === 'open' ? (
        <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
          {activity.options.map((option) => {
            const selected = choice === option.id;
            return (
              <Press
                key={option.id}
                testID={`poll-option-${option.id}`}
                onPress={() => {
                  haptic.selection();
                  setChoice(option.id);
                }}
                scaleTo={0.985}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={l(option.label)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: hitTarget + 4,
                  paddingHorizontal: space.md,
                  borderRadius: radius.md,
                  borderCurve: 'continuous',
                  borderWidth: 1.5,
                  borderColor: selected ? theme.accent : theme.hairline,
                }}
              >
                <CheckMark checked={selected} size={22} />
                <Text variant="callout" style={{ flex: 1, fontWeight: selected ? '600' : '400' }}>
                  {l(option.label)}
                </Text>
              </Press>
            );
          })}
          <Button
            testID="poll-submit"
            label={t('fan.vote.cta')}
            fill
            disabled={!choice}
            loading={pending}
            style={{ marginTop: space.xs }}
            onPress={async () => {
              if (!choice) return;
              const ok = await submit(activity.id, {
                kind: 'poll',
                activityId: activity.id,
                optionId: choice,
              });
              if (ok) track('fanzone_vote_submit', { activity_id: activity.id });
            }}
          />
        </View>
      ) : null}
      <ErrorLine error={error} />
    </Shell>
  );
}

export function QuizCard({ activity, receipts }: { activity: QuizActivity; receipts: Receipt[] }) {
  const t = useT();
  const router = useRouter();
  const mine = receiptFor(receipts, activity.id);
  return (
    <Shell activity={activity} icon="help-circle" testID="activity-quiz">
      {activity.editorialStatus === 'awaiting_approval' ? (
        <Tag label={t('fan.quiz.review')} icon="hourglass-outline" tone="warning" />
      ) : null}
      {mine ? (
        <Text variant="title2" testID="quiz-score" numeric>
          {t('fan.quiz.score', { score: mine.summary })}
        </Text>
      ) : (
        <Button
          testID="quiz-start"
          label={t('fan.quiz.start')}
          fill
          onPress={() => router.push({ pathname: '/quiz', params: { id: activity.id } })}
        />
      )}
    </Shell>
  );
}

export function FanCamCard({
  activity,
  receipts,
}: {
  activity: FanCamActivity;
  receipts: Receipt[];
}) {
  const t = useT();
  const router = useRouter();
  const now = useNow(15_000);
  const account = useSession((s) => s.account);
  const withdraw = useWithdrawSubmission();
  const window = activityWindow(activity, now);
  const sent = receipts.filter((r) => r.activityId === activity.id);
  return (
    <Shell activity={activity} icon="camera" testID="activity-fancam">
      {sent.map((receipt) => {
        const withdrawn = receipt.moderation === 'withdrawn';
        return (
          <View
            key={receipt.id}
            testID="fancam-receipt"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}
          >
            <Tag
              label={withdrawn ? t('fan.cam.withdrawn') : t('fan.cam.pending')}
              icon={withdrawn ? 'close-circle-outline' : 'hourglass-outline'}
              tone={withdrawn ? 'neutral' : 'warning'}
            />
            {!withdrawn ? (
              <Button
                testID="fancam-withdraw"
                label={t('fan.cam.withdraw')}
                variant="ghost"
                size="sm"
                onPress={() => withdraw.mutate(receipt.id)}
              />
            ) : null}
          </View>
        );
      })}
      {window === 'open' ? (
        account === 'guest' ? (
          <Button
            testID="fancam-signin"
            label={t('fan.cam.signin')}
            variant="secondary"
            fill
            onPress={() => router.push('/sign-in')}
          />
        ) : (
          <Button
            testID="fancam-start"
            label={t('fan.cam.cta')}
            icon="camera"
            fill
            onPress={() => router.push({ pathname: '/fan-cam', params: { id: activity.id } })}
          />
        )
      ) : null}
    </Shell>
  );
}

export function ChallengeCard({
  activity,
  receipts,
}: {
  activity: ChallengeActivity;
  receipts: Receipt[];
}) {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const { submit, error } = useSubmit();
  const done = new Set(
    receipts
      .filter((r) => r.activityId === activity.id && r.submission.kind === 'challenge')
      .map((r) => (r.submission.kind === 'challenge' ? r.submission.stepId : '')),
  );
  return (
    <Shell activity={activity} icon="flash" testID="activity-challenge">
      <View style={{ gap: space.xs }}>
        {activity.steps.map((step) => {
          const complete = done.has(step.id);
          return (
            <Press
              key={step.id}
              testID={`challenge-step-${step.id}`}
              disabled={complete}
              dimWhenDisabled={false}
              onPress={() =>
                void submit(activity.id, {
                  kind: 'challenge',
                  activityId: activity.id,
                  stepId: step.id,
                })
              }
              scaleTo={0.985}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: complete }}
              accessibilityLabel={`${l(step.label)}. ${complete ? t('fan.challenge.done') : t('fan.challenge.mark')}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                minHeight: hitTarget,
              }}
            >
              <CheckMark checked={complete} size={24} />
              <Text variant="callout" style={{ flex: 1 }}>
                {l(step.label)}
              </Text>
            </Press>
          );
        })}
      </View>
      <View
        style={{
          padding: space.md,
          borderRadius: radius.md,
          backgroundColor: theme.surfaceMuted,
          gap: 2,
        }}
      >
        <Text variant="eyebrow" color="textSecondary">
          {t('fan.challenge.alternative')}
        </Text>
        <Text variant="footnote" color="textSecondary">
          {l(activity.accessibleAlternative)}
        </Text>
      </View>
      <ErrorLine error={error} />
    </Shell>
  );
}
