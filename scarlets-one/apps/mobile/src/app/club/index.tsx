import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { DataStamp } from '@/components/Chips';
import { Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { Press } from '@/components/Press';
import { RowGroup, SectionHeader } from '@/components/Rows';
import { ErrorState, SkeletonList } from '@/components/States';
import { StoryRow } from '@/components/StoryCard';
import { Text } from '@/components/Text';
import { useClub, useContentList } from '@/data/queries';
import { useL, useT } from '@/i18n';
import { radius, space, useTheme } from '@/theme';

/** The whole club, not only the senior men's side: every pathway gets equal billing. */
export default function ClubScreen() {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const router = useRouter();
  const club = useClub();
  const stories = useContentList();
  const editorial = (stories.data?.data ?? []).filter((item) => !item.link);
  return (
    <Page testID="screen-club" title={t('club.title')} back eyebrow={t('app.tagline')}>
      <View style={{ gap: space.xxl }}>
        {club.isPending ? <SkeletonList rows={4} /> : null}
        {club.isError ? <ErrorState onRetry={() => void club.refetch()} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {(club.data?.data ?? []).map((section) => (
            <Press
              key={section.id}
              testID={`club-${section.id}`}
              onPress={() =>
                router.push({ pathname: '/club/[section]', params: { section: section.id } })
              }
              scaleTo={0.975}
              accessibilityLabel={`${l(section.title)}. ${l(section.intro)}`}
              style={{
                flexGrow: 1,
                flexBasis: '45%',
                height: 150,
                borderRadius: radius.xl,
                borderCurve: 'continuous',
                overflow: 'hidden',
                backgroundColor: theme.inverse,
                justifyContent: 'flex-end',
              }}
            >
              <Photo id={section.mediaId} style={StyleSheet.absoluteFill} decorative />
              <LinearGradient
                colors={['rgba(25,22,25,0)', 'rgba(25,22,25,0.88)']}
                locations={[0.3, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text variant="headline" color="onInverse" style={{ padding: space.md }}>
                {l(section.title)}
              </Text>
            </Press>
          ))}
        </View>
        <View style={{ gap: space.md }}>
          <SectionHeader title={t('club.stories')} />
          {stories.data ? <DataStamp meta={stories.data.meta} /> : null}
          {stories.isPending ? <SkeletonList rows={4} /> : null}
          <RowGroup style={{ paddingHorizontal: space.lg, paddingVertical: space.xs }}>
            {editorial.map((item) => (
              <StoryRow key={item.id} item={item} />
            ))}
          </RowGroup>
        </View>
      </View>
    </Page>
  );
}
