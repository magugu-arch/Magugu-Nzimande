import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, PlacementTag } from '@/components/Chips';
import { Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { ErrorState, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { usePartnerWorld } from '@/data/queries';
import { useT } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { space } from '@/theme';

/** Retail is a link-out: prices, stock and checkout stay with the official store. */
export default function ShopScreen() {
  const t = useT();
  const query = usePartnerWorld();
  const shop = query.data?.shop;
  return (
    <Page testID="screen-shop" title={t('shop.title')} back>
      <View style={{ gap: space.lg }}>
        {query.isPending ? <SkeletonList rows={3} /> : null}
        {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <Photo
            id="shirt-reference"
            contentFit="contain"
            style={{ height: 300, backgroundColor: '#FFFFFF' }}
          />
          <View style={{ padding: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <PlacementTag label="official_shop" />
              <DemoChip />
            </View>
            <Text variant="body">{t('shop.body')}</Text>
            <Text variant="caption" color="textSecondary">
              {t('shop.kitNote')}
            </Text>
            {shop?.data ? (
              <Button
                testID="shop-open"
                label={t('shop.cta')}
                icon="bag-handle"
                fill
                accessibilityHint={
                  shop.data.confirmed ? t('common.official') : t('common.destinationPending')
                }
                onPress={() => {
                  track('offer_view', { placement: 'shop' });
                  if (shop.data) void openOfficial(shop.data.url);
                }}
              />
            ) : null}
            {shop?.data && !shop.data.confirmed ? (
              <Text variant="caption" color="textSecondary">
                {t('common.destinationPending')}
              </Text>
            ) : null}
          </View>
        </Card>
        {shop ? <DataStamp meta={shop.meta} /> : null}
      </View>
    </Page>
  );
}
