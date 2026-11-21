import type { MediaAsset } from '@scarlets/domain';
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { DataStamp, Tag } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { Press } from '@/components/Press';
import { RowGroup } from '@/components/Rows';
import { Sheet } from '@/components/Sheet';
import { ErrorState, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { useMediaLibrary } from '@/data/queries';
import { useL, useT, type MessageKey } from '@/i18n';
import { MAX_CONTENT_WIDTH, radius, space, useTheme } from '@/theme';

/**
 * Every supplied visual in one place, each marked as concept material, with
 * the gaps the briefing says must be filled before production.
 */
export default function LibraryScreen() {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const query = useMediaLibrary();
  const [open, setOpen] = useState<MediaAsset | null>(null);
  const assets = query.data?.data ?? [];
  const identity = assets.filter((a) => a.kind === 'identity');
  const photos = assets.filter((a) => a.kind === 'photograph');
  const column = (Math.min(width, MAX_CONTENT_WIDTH) - space.xl * 2 - space.sm * 2) / 3;

  const tile = (asset: MediaAsset, size: number, fit: 'cover' | 'contain' = 'cover') => (
    <Press
      key={asset.id}
      testID={`asset-${asset.number}`}
      onPress={() => setOpen(asset)}
      scaleTo={0.96}
      accessibilityLabel={`${t('library.asset', { n: asset.number })}. ${l(asset.label)}`}
      style={{ width: size, gap: 4 }}
    >
      <Photo
        id={asset.id}
        contentFit={fit}
        decorative
        style={{
          width: size,
          height: size,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: fit === 'contain' ? '#FFFFFF' : undefined,
        }}
      />
      <Text variant="caption" color="textSecondary" numeric numberOfLines={1}>
        {String(asset.number).padStart(2, '0')}
      </Text>
    </Press>
  );

  return (
    <Page testID="screen-library" title={t('library.title')} back>
      <View style={{ gap: space.xl }}>
        <Text variant="body" color="textSecondary">
          {t('library.intro')}
        </Text>
        {query.isPending ? <SkeletonList rows={4} /> : null}
        {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}
        {query.data ? <DataStamp meta={query.data.meta} /> : null}

        <View style={{ gap: space.sm }}>
          <Text variant="eyebrow" color="textSecondary" accessibilityRole="header">
            {t('library.identity')} · {identity.length}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {identity.map((asset) => tile(asset, column, 'contain'))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text
            variant="eyebrow"
            color="textSecondary"
            accessibilityRole="header"
            testID="library-count"
          >
            {t('library.photography')} · {photos.length}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {photos.map((asset) => tile(asset, column))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="eyebrow" color="textSecondary" accessibilityRole="header">
            {t('library.gaps')}
          </Text>
          <RowGroup>
            {(['library.gap1', 'library.gap2', 'library.gap3', 'library.gap4'] as MessageKey[]).map(
              (key) => (
                <View
                  key={key}
                  style={{
                    flexDirection: 'row',
                    gap: space.md,
                    alignItems: 'center',
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                  }}
                >
                  <Icon name="alert-circle-outline" size={18} color={theme.warning} />
                  <Text variant="callout" style={{ flex: 1 }}>
                    {t(key)}
                  </Text>
                </View>
              ),
            )}
          </RowGroup>
        </View>
      </View>

      <Sheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${t('library.asset', { n: open.number })}` : ''}
        testID="asset-sheet"
      >
        {open ? (
          <View style={{ gap: space.md }}>
            <Photo
              id={open.id}
              contentFit="contain"
              style={{
                width: '100%',
                aspectRatio: open.width / open.height,
                maxHeight: 360,
                borderRadius: radius.lg,
                backgroundColor: open.kind === 'identity' ? '#FFFFFF' : theme.surfaceMuted,
              }}
            />
            <Text variant="title3">{l(open.label)}</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Tag label={t('concept.image')} icon="image-outline" tone="gold" />
              <Tag label={open.supplied} />
              <Tag label={`${open.width} × ${open.height}`} />
            </View>
            <Text variant="callout" color="textSecondary">
              {t('library.placement', { placement: open.placement })}
            </Text>
            <Text variant="callout">{l(open.alt)}</Text>
            {open.note ? (
              <Text variant="footnote" color="warning">
                {l(open.note)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Page>
  );
}
