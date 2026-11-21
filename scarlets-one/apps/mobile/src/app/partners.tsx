import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, PlacementTag, Tag } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { RowGroup, SectionHeader } from '@/components/Rows';
import { ErrorState, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { usePartnerWorld } from '@/data/queries';
import { useL, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { space, useTheme } from '@/theme';

export default function PartnerWorldScreen() {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const query = usePartnerWorld();
  const world = query.data;
  return (
    <Page
      testID="screen-partners"
      title={t('partners.title')}
      back
      hero={{
        mediaId: 'partner-hospitality',
        height: 300,
        content: (
          <View style={{ gap: space.sm }}>
            <Text variant="display" color="onInverse" accessibilityRole="header">
              {t('partners.title')}
            </Text>
            <Text variant="callout" color="onInverseMuted">
              {t('partners.intro')}
            </Text>
          </View>
        ),
      }}
    >
      {query.isPending ? <SkeletonList rows={5} /> : null}
      {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}
      {world ? (
        <View style={{ gap: space.xxl }}>
          <View style={{ gap: space.md }}>
            <SectionHeader title={t('partners.directory')} />
            <DataStamp meta={world.partners.meta} />
            <RowGroup>
              {(world.partners.data ?? []).map((partner) => (
                <View
                  key={partner.id}
                  style={{
                    flexDirection: 'row',
                    gap: space.md,
                    padding: space.lg,
                    alignItems: 'flex-start',
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: theme.textSecondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="add" size={20} color={theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="eyebrow" color="goldText">
                      {l(partner.category)}
                    </Text>
                    <Text variant="headline">{partner.name}</Text>
                    <Text variant="footnote" color="textSecondary">
                      {l(partner.description)}
                    </Text>
                    {!partner.approved ? (
                      <Tag
                        label={t('common.awaitingClub')}
                        icon="hourglass-outline"
                        tone="warning"
                        style={{ marginTop: 3 }}
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </RowGroup>
          </View>

          <View style={{ gap: space.md }}>
            <SectionHeader title={t('partners.hospitality')} />
            {(world.hospitality.data ?? []).map((pack) => (
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
                  <Button
                    label={t('matchday.hospitality.enquire')}
                    variant="secondary"
                    size="sm"
                    iconAfter="open-outline"
                    accessibilityHint={t('common.destinationPending')}
                    onPress={() => {
                      track('offer_view', { offer_id: pack.id, placement: 'partner_world' });
                      void openOfficial(pack.enquiryUrl);
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>

          {world.campaigns
            .filter((c) => c.placement === 'partner_world')
            .map((campaign) => (
              <Card key={campaign.id} testID="partner-shop" style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <PlacementTag label={campaign.label} />
                  <DemoChip />
                </View>
                <Text variant="title3">{l(campaign.title)}</Text>
                <Text variant="callout" color="textSecondary">
                  {l(campaign.body)}
                </Text>
                {campaign.cta ? (
                  <Button
                    label={l(campaign.cta.label)}
                    variant="secondary"
                    size="sm"
                    iconAfter="open-outline"
                    accessibilityHint={t('common.destinationPending')}
                    onPress={() => (campaign.cta ? void openOfficial(campaign.cta.url) : undefined)}
                  />
                ) : null}
              </Card>
            ))}

          <Card tone="muted" style={{ gap: space.sm }}>
            <Text variant="title3" accessibilityRole="header">
              {t('partners.rules')}
            </Text>
            {(
              [
                'partners.rule1',
                'partners.rule2',
                'partners.rule3',
                'partners.rule4',
              ] as MessageKey[]
            ).map((key) => (
              <View
                key={key}
                style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}
              >
                <Icon name="checkmark-circle" size={18} color={theme.success} />
                <Text variant="callout" style={{ flex: 1 }}>
                  {t(key)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </Page>
  );
}
