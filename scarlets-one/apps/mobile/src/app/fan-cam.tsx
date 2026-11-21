import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { DemoChip } from '@/components/Chips';
import { CheckRow } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { ModalScreen } from '@/components/Modal';
import { Notice } from '@/components/States';
import { Text } from '@/components/Text';
import { useSubmit } from '@/features/fanzone/cards';
import { useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { radius, space, useTheme } from '@/theme';

/**
 * Fan Cam: choose a photo, give three separate permissions, send it to a
 * moderator. Nothing is shown to anyone else until it is approved, and the
 * supporter can withdraw it at any time.
 *
 * DEMO: the photo never leaves the device. A real build uploads it to
 * private storage with type and size checks before a moderator sees it.
 */
export default function FanCamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { submit, error, pending } = useSubmit();
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState({
    ageOrGuardian: false,
    peopleInPhoto: false,
    displayAndModeration: false,
  });
  const [sent, setSent] = useState(false);
  const allowed = consent.ageOrGuardian && consent.peopleInPhoto && consent.displayAndModeration;

  const choose = async () => {
    // The system picker gives access to the one photo chosen, not the library.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  };

  if (sent) {
    return (
      <ModalScreen
        testID="fancam-sent"
        title={t('fan.cam.cta')}
        footer={
          <Button
            testID="fancam-done"
            label={t('common.done')}
            fill
            onPress={() => router.back()}
          />
        }
      >
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <Icon name="shield-checkmark" size={54} color={theme.success} />
          <Text variant="title1" align="center" accessibilityRole="header">
            {t('fan.cam.sentTitle')}
          </Text>
          <Text variant="body" color="textSecondary" align="center">
            {t('fan.cam.sentBody')}
          </Text>
          <DemoChip />
        </View>
      </ModalScreen>
    );
  }

  return (
    <ModalScreen
      testID="fancam"
      title={t('fan.cam.cta')}
      footer={
        <>
          {error ? (
            <Text variant="footnote" color="warning" testID="submit-error">
              {t(`error.${error}` as MessageKey)}
            </Text>
          ) : null}
          <Button
            testID="fancam-send"
            label={t('fan.cam.send')}
            fill
            disabled={!photo || !allowed}
            loading={pending}
            onPress={async () => {
              if (!photo) return;
              // The reference is opaque: the photo's contents are never put in the request.
              const ok = await submit(id, {
                kind: 'fan_cam',
                activityId: id,
                mediaRef: `local:${Date.now()}`,
                consent,
              });
              if (ok) {
                track('fanzone_fancam_submit', { activity_id: id });
                setSent(true);
              }
            }}
          />
        </>
      }
    >
      {photo ? (
        <View style={{ gap: space.md }}>
          <Image
            source={{ uri: photo }}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.xl }}
            contentFit="cover"
            accessibilityLabel={t('fan.cam.choose')}
          />
          <Button
            testID="fancam-replace"
            label={t('fan.cam.replace')}
            variant="secondary"
            size="sm"
            onPress={() => void choose()}
          />
        </View>
      ) : (
        <View
          style={{
            alignItems: 'center',
            gap: space.md,
            padding: space.xxl,
            borderRadius: radius.xl,
            borderCurve: 'continuous',
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: theme.hairline,
          }}
        >
          <Icon name="image-outline" size={44} color={theme.textSecondary} />
          <Text variant="callout" color="textSecondary" align="center">
            {t('fan.cam.chooseBody')}
          </Text>
          <Button
            testID="fancam-choose"
            label={t('fan.cam.choose')}
            icon="images"
            onPress={() => void choose()}
            style={{ alignSelf: 'center' }}
          />
        </View>
      )}
      <View style={{ gap: space.xs }}>
        <Text variant="title3" accessibilityRole="header">
          {t('fan.cam.consentTitle')}
        </Text>
        <CheckRow
          testID="consent-age"
          checked={consent.ageOrGuardian}
          onToggle={() => setConsent({ ...consent, ageOrGuardian: !consent.ageOrGuardian })}
          title={t('consent.age')}
        />
        <CheckRow
          testID="consent-people"
          checked={consent.peopleInPhoto}
          onToggle={() => setConsent({ ...consent, peopleInPhoto: !consent.peopleInPhoto })}
          title={t('consent.people')}
        />
        <CheckRow
          testID="consent-display"
          checked={consent.displayAndModeration}
          onToggle={() =>
            setConsent({ ...consent, displayAndModeration: !consent.displayAndModeration })
          }
          title={t('consent.display')}
        />
      </View>
      <Notice icon="flask-outline" body={t('fan.cam.demoNote')} />
    </ModalScreen>
  );
}
