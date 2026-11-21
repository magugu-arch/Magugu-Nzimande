import type { Fixture, VenuePoint } from '@scarlets/domain';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DemoChip } from '@/components/Chips';
import { CheckMark } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Press } from '@/components/Press';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { fixtureTitle, kickoff } from '@/features/format';
import { useL, useLocale, useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { shareText } from '@/lib/links';
import { useMatchdayPlan } from '@/state/matchday';
import { hitTarget, space, useTheme } from '@/theme';

/**
 * Pick a meeting point and send it to your group. The choice stays on this
 * device; sharing uses the phone's own share sheet, so the app never sees
 * who it went to.
 */
export function MeetingPoint({ fixture, points }: { fixture: Fixture; points: VenuePoint[] }) {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const chosenId = useMatchdayPlan((s) => s.meetingPoint[fixture.id]);
  const setMeetingPoint = useMatchdayPlan((s) => s.setMeetingPoint);
  const options = points.filter((p) => p.kind === 'meeting');
  const chosen = options.find((p) => p.id === chosenId);
  const when = kickoff(fixture, locale);

  return (
    <Card testID="meeting-point" style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
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
          <Icon name="people" size={22} color={theme.accentText} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="eyebrow" color="textSecondary">
            {t('matchday.meeting.title')}
          </Text>
          <Text variant="title3" testID="meeting-point-value">
            {chosen ? l(chosen.label) : t('matchday.meeting.choose')}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {chosen?.note ? l(chosen.note) : t('matchday.meeting.none')}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          testID="meeting-point-choose"
          label={chosen ? t('common.change') : t('matchday.meeting.choose')}
          variant={chosen ? 'secondary' : 'primary'}
          size="sm"
          onPress={() => setOpen(true)}
        />
        {chosen ? (
          <Button
            testID="meeting-point-share"
            label={t('matchday.meeting.share')}
            size="sm"
            icon="share-outline"
            onPress={() =>
              void shareText(
                t('matchday.meeting.message', {
                  point: l(chosen.label),
                  fixture: fixtureTitle(fixture),
                  date: when.longDate,
                  time: `${when.time} ${when.zone}`,
                }),
              )
            }
          />
        ) : null}
        <DemoChip />
      </View>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('matchday.meeting.choose')}
        testID="meeting-sheet"
      >
        <View style={{ gap: space.xs }}>
          {options.map((option) => {
            const selected = option.id === chosenId;
            return (
              <Press
                key={option.id}
                testID={`meeting-option-${option.id}`}
                onPress={() => {
                  haptic.selection();
                  setMeetingPoint(fixture.id, option.id);
                  setOpen(false);
                }}
                scaleTo={0.985}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={l(option.label)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: hitTarget + 8,
                  paddingVertical: space.sm,
                }}
              >
                <CheckMark checked={selected} />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">{l(option.label)}</Text>
                  {option.note ? (
                    <Text variant="footnote" color="textSecondary">
                      {l(option.note)}
                    </Text>
                  ) : null}
                </View>
              </Press>
            );
          })}
          <Text variant="footnote" color="textSecondary" style={{ marginTop: space.sm }}>
            {t('matchday.map.notice')}
          </Text>
        </View>
      </Sheet>
    </Card>
  );
}
