import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { Page } from '@/components/Page';
import { ListRow, RowGroup } from '@/components/Rows';
import { Notice } from '@/components/States';
import { Text } from '@/components/Text';
import { useClub } from '@/data/queries';
import { useL, useLocale, useT, type MessageKey } from '@/i18n';
import { useSession } from '@/state/session';
import { space } from '@/theme';

const SECTION_ICON: Record<string, string> = {
  'first-team': 'shield-outline',
  women: 'star-outline',
  academy: 'school-outline',
  community: 'people-outline',
  history: 'library-outline',
  leadership: 'business-outline',
};

/** Secondary destinations. The five high-frequency ones stay on the tab bar. */
export default function MoreScreen() {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const router = useRouter();
  const account = useSession((s) => s.account);
  const club = useClub();
  const go = (href: Href) => () => router.push(href);
  const group = (title: MessageKey, rows: React.ReactNode) => (
    <View style={{ gap: space.sm }}>
      <Text
        variant="eyebrow"
        color="textSecondary"
        accessibilityRole="header"
        style={{ marginLeft: space.lg }}
      >
        {t(title)}
      </Text>
      <RowGroup>{rows}</RowGroup>
    </View>
  );
  return (
    <Page testID="screen-more" title={t('more.title')} back>
      <View style={{ gap: space.xl }}>
        <RowGroup>
          <ListRow
            testID="more-account"
            icon={account === 'guest' ? 'person-circle-outline' : 'person-circle'}
            title={t(`more.account.${account}` as MessageKey)}
            subtitle={account === 'guest' ? t('common.signIn') : t('passport.title')}
            onPress={go(account === 'guest' ? '/sign-in' : '/passport')}
          />
        </RowGroup>
        {group(
          'more.section.club',
          <>
            <ListRow
              testID="more-club"
              icon="shield-half-outline"
              title={t('more.club')}
              onPress={go('/club')}
            />
            {(club.data?.data ?? []).map((section) => (
              <ListRow
                key={section.id}
                testID={`more-club-${section.id}`}
                icon={SECTION_ICON[section.id] ?? 'ellipse-outline'}
                title={l(section.title)}
                onPress={go({ pathname: '/club/[section]', params: { section: section.id } })}
              />
            ))}
          </>,
        )}
        {group(
          'more.section.explore',
          <>
            <ListRow
              testID="more-partners"
              icon="ribbon-outline"
              title={t('more.partners')}
              onPress={go('/partners')}
            />
            <ListRow
              testID="more-watch"
              icon="play-circle-outline"
              title={t('more.watch')}
              onPress={go('/watch')}
            />
            <ListRow
              testID="more-shop"
              icon="bag-handle-outline"
              title={t('more.shop')}
              onPress={go('/shop')}
            />
          </>,
        )}
        {group(
          'more.section.app',
          <>
            <ListRow
              testID="more-help"
              icon="help-buoy-outline"
              title={t('more.help')}
              onPress={go('/help')}
            />
            <ListRow
              testID="more-language"
              icon="language-outline"
              title={t('more.language')}
              subtitle={locale === 'cy' ? 'Cymraeg' : 'English'}
              onPress={go('/settings')}
            />
            <ListRow
              testID="more-settings"
              icon="settings-outline"
              title={t('more.settings')}
              onPress={go('/settings')}
            />
            <ListRow
              testID="more-demo"
              icon="flask-outline"
              title={t('more.demo')}
              onPress={go('/demo')}
            />
            <ListRow
              testID="more-library"
              icon="images-outline"
              title={t('more.library')}
              onPress={go('/library')}
            />
          </>,
        )}
        <Notice icon="flask-outline" body={t('settings.about.body')} />
      </View>
    </Page>
  );
}
