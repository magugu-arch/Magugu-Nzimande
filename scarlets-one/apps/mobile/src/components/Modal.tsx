import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { MAX_CONTENT_WIDTH, hitTarget, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';

/** A focused task presented over the app. Close is always in the same place. */
export function ModalScreen({
  title,
  children,
  footer,
  testID,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center' }}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: Math.max(insets.top, space.md),
            paddingLeft: space.xl,
            paddingRight: space.sm,
            minHeight: hitTarget + space.md,
          }}
        >
          <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
            {title}
          </Text>
          <Press
            testID="modal-close"
            onPress={close}
            accessibilityLabel={t('common.close')}
            style={{
              width: hitTarget,
              height: hitTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: theme.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="close" size={19} color={theme.text} />
            </View>
          </Press>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: space.xl,
              paddingTop: space.md,
              paddingBottom: Math.max(insets.bottom, space.lg),
              gap: space.sm,
            }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  );
}
