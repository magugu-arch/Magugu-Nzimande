import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Page } from '@/components/Page';
import { Notice } from '@/components/States';
import { useT } from '@/i18n';

/** A wrong link never traps anyone: there is always a way back to Home. */
export default function NotFoundScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <Page testID="screen-not-found" title={t('app.name')} back>
      <Notice icon="compass-outline" body={t('common.notFound')} />
      <Button
        label={t('common.goHome')}
        onPress={() => router.replace('/')}
        style={{ marginTop: 16 }}
      />
    </Page>
  );
}
