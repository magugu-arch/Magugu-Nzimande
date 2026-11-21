import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { DemoChip } from '@/components/Chips';
import { ModalScreen } from '@/components/Modal';
import { ListRow, RowGroup } from '@/components/Rows';
import { Notice } from '@/components/States';
import { Text } from '@/components/Text';
import { useT } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/state/session';
import { space } from '@/theme';

/**
 * DEMO SIGN-IN. Two demo accounts stand in for the club's identity provider.
 * No email, password or phone number is asked for or stored.
 */
export default function SignInScreen() {
  const t = useT();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const choose = (account: 'supporter' | 'member') => {
    signIn(account);
    haptic.success();
    track('membership_cta_tap', { placement: 'sign_in', linked: account === 'member' });
    if (router.canGoBack()) router.back();
    else router.replace('/passport');
  };
  return (
    <ModalScreen testID="screen-sign-in" title={t('signin.title')}>
      <Text variant="body" color="textSecondary">
        {t('signin.body')}
      </Text>
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text variant="eyebrow" color="textSecondary">
            {t('signin.demo')}
          </Text>
          <DemoChip />
        </View>
        <RowGroup>
          <ListRow
            testID="sign-in-supporter"
            icon="person-outline"
            title={t('signin.supporter')}
            subtitle={t('signin.supporter.body')}
            onPress={() => choose('supporter')}
          />
          <ListRow
            testID="sign-in-member"
            icon="ribbon-outline"
            title={t('signin.member')}
            subtitle={t('signin.member.body')}
            onPress={() => choose('member')}
          />
        </RowGroup>
      </View>
      <Notice icon="lock-closed-outline" body={t('signin.note')} />
    </ModalScreen>
  );
}
