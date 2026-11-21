import { OFFICIAL_SITE } from '@scarlets/adapters';
import { guideSectionId, type GuideAction, type VenuePointKind } from '@scarlets/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, Tag } from '@/components/Chips';
import { ChipRow } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { Press } from '@/components/Press';
import { RowGroup } from '@/components/Rows';
import { ErrorState, Notice, SkeletonList, SourceNotice } from '@/components/States';
import { Text } from '@/components/Text';
import { useMatchday } from '@/data/queries';
import { MeetingPoint } from '@/features/matchday/MeetingPoint';
import { KIND_ICON, VenueMap } from '@/features/matchday/VenueMap';
import { useL, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { hitTarget, space, useTheme } from '@/theme';

type Filter = 'all' | VenuePointKind;

function ActionButton({ action }: { action: GuideAction }) {
  const t = useT();
  const l = useL();
  // The club still has to confirm some destinations; those open the site's front page and say so.
  const pending = action.url === OFFICIAL_SITE;
  return (
    <View style={{ gap: space.xs }}>
      <Button
        label={l(action.label)}
        variant="secondary"
        size="sm"
        iconAfter="open-outline"
        accessibilityHint={pending ? t('common.destinationPending') : t('common.official')}
        onPress={() => void openOfficial(action.url)}
      />
      {pending ? (
        <Text variant="caption" color="textSecondary">
          {t('common.destinationPending')}
        </Text>
      ) : null}
    </View>
  );
}

export default function GuideSectionScreen() {
  const params = useLocalSearchParams<{ section: string }>();
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const query = useMatchday();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const id = guideSectionId.safeParse(params.section);
  const day = query.data;
  const guide = day?.guide.data;
  const fixture = day?.fixture.data ?? null;
  const section = id.success ? guide?.sections.find((s) => s.id === id.data) : undefined;

  if (query.isPending) {
    return (
      <Page title={t('matchday.title')} back>
        <SkeletonList rows={5} />
      </Page>
    );
  }
  if (!day || !guide || !section) {
    return (
      <Page title={t('matchday.title')} back>
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <Notice body={t('common.notFound')} />
        )}
      </Page>
    );
  }

  const kinds = [...new Set(guide.points.map((p) => p.kind))];
  const visible = guide.points.filter((p) => filter === 'all' || p.kind === filter);

  return (
    <Page
      testID={`screen-guide-${section.id}`}
      title={l(section.title)}
      back
      hero={{
        mediaId: section.mediaId,
        height: 280,
        content: (
          <View style={{ gap: space.xs }}>
            <Text variant="eyebrow" color="goldOnInverse">
              {t('matchday.title')}
            </Text>
            <Text variant="display" color="onInverse" accessibilityRole="header">
              {l(section.title)}
            </Text>
            <Text variant="callout" color="onInverseMuted">
              {l(section.summary)}
            </Text>
          </View>
        ),
      }}
    >
      <View style={{ gap: space.lg }}>
        <DataStamp meta={day.guide.meta} showNotice />

        {section.id === 'tickets' ? (
          day.ticket?.data ? (
            <Button
              testID="guide-tickets"
              label={l(day.ticket.data.label)}
              icon="ticket"
              fill
              accessibilityHint={t('common.official')}
              onPress={() => {
                track('ticket_cta_tap', {
                  fixture_id: fixture?.id ?? 'none',
                  placement: 'matchday_guide',
                });
                if (day.ticket?.data) void openOfficial(day.ticket.data.url);
              }}
            />
          ) : day.ticket ? (
            <SourceNotice meta={day.ticket.meta} fallback={t('status.unavailable')} />
          ) : null
        ) : null}

        {section.id === 'wallet' ? (
          day.ticketAccount.data ? (
            <Button
              label={t('matchday.wallet')}
              icon="wallet"
              fill
              accessibilityHint={t('common.official')}
              onPress={() =>
                day.ticketAccount.data ? void openOfficial(day.ticketAccount.data.url) : undefined
              }
            />
          ) : (
            <SourceNotice meta={day.ticketAccount.meta} fallback={t('status.unavailable')} />
          )
        ) : null}

        {section.id === 'map' ? (
          <View style={{ gap: space.md }}>
            <Notice icon="warning-outline" body={t('matchday.map.notice')} testID="map-notice" />
            <ChipRow
              testID="map-filter"
              accessibilityLabel={l(section.title)}
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setSelected(null);
              }}
              options={[
                { id: 'all' as Filter, label: t('common.seeAll') },
                ...kinds.map((kind) => ({
                  id: kind as Filter,
                  label: t(`kind.${kind}` as MessageKey),
                })),
              ]}
            />
            <VenueMap points={visible} selected={selected} onSelect={setSelected} />
            <Text variant="eyebrow" color="textSecondary">
              {t('matchday.map.list')}
            </Text>
            <RowGroup>
              {visible.map((point) => {
                const active = point.id === selected;
                return (
                  <Press
                    key={point.id}
                    testID={`point-${point.id}`}
                    onPress={() => setSelected(active ? null : point.id)}
                    scaleTo={0.985}
                    accessibilityLabel={`${l(point.label)}. ${t(`kind.${point.kind}` as MessageKey)}`}
                    accessibilityState={{ selected: active }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      minHeight: hitTarget + 8,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.sm,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: active ? theme.accent : theme.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name={KIND_ICON[point.kind]}
                        size={16}
                        color={active ? theme.onAccent : theme.text}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="headline">{l(point.label)}</Text>
                      <Text variant="footnote" color="textSecondary">
                        {point.note ? l(point.note) : t(`kind.${point.kind}` as MessageKey)}
                      </Text>
                    </View>
                    <DemoChip />
                  </Press>
                );
              })}
            </RowGroup>
          </View>
        ) : null}

        {section.id === 'crew' && fixture ? (
          <MeetingPoint fixture={fixture} points={guide.points} />
        ) : null}

        {section.blocks.map((block) => (
          <Card key={block.id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <Icon name={block.icon} size={22} color={theme.accentText} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="title3" accessibilityRole="header">
                  {l(block.title)}
                </Text>
                <Text variant="body" color="textSecondary">
                  {l(block.body)}
                </Text>
              </View>
            </View>
            <Tag
              label={block.approval === 'venue_approved' ? '✓' : t('common.awaitingVenue')}
              icon={block.approval === 'venue_approved' ? 'checkmark-circle' : 'hourglass-outline'}
              tone={block.approval === 'venue_approved' ? 'success' : 'warning'}
            />
            {block.action ? <ActionButton action={block.action} /> : null}
          </Card>
        ))}

        {section.id === 'hospitality'
          ? (day.hospitality.data ?? []).map((pack) => (
              <Card key={pack.id} padded={false} style={{ overflow: 'hidden' }}>
                <Photo id={pack.mediaId} style={{ height: 170 }} />
                <View style={{ padding: space.lg, gap: space.sm }}>
                  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                    <Tag label={t('common.awaitingClub')} icon="hourglass-outline" tone="warning" />
                    <DemoChip />
                  </View>
                  <Text variant="title3" accessibilityRole="header">
                    {l(pack.title)}
                  </Text>
                  <Text variant="callout" color="textSecondary">
                    {l(pack.summary)}
                  </Text>
                  {pack.includes.map((line, index) => (
                    <Text key={index} variant="footnote" color="textSecondary">
                      {l(line)}
                    </Text>
                  ))}
                </View>
              </Card>
            ))
          : null}
      </View>
    </Page>
  );
}
