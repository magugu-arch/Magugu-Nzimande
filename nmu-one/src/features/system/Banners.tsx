import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Icon, IconButton, Text, Touchable, colors, elevation, radius, spacing } from '@/design';
import { useOnline } from '@/state/connectivity';
import { useToasts } from '@/state/toasts';

const VISIBLE_MS = 7_000;

/**
 * The in-app banner for notifications and confirmations. Announced politely
 * to screen readers; dismissible; tapping it opens the notification's action.
 */
export function InAppBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToasts((s) => s.queue[0]);
  const dismiss = useToasts((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => dismiss(toast.id),
      toast.tone === 'urgent' ? VISIBLE_MS * 2 : VISIBLE_MS,
    );
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast) return null;
  const urgent = toast.tone === 'urgent';
  const open = () => {
    dismiss(toast.id);
    if (toast.href) router.push(toast.href as Href);
  };

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      <View
        testID="in-app-banner"
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.banner, urgent ? styles.urgent : styles.info, elevation.float]}
      >
        <Touchable
          onPress={open}
          disabled={!toast.href}
          accessibilityLabel={`${toast.title}. ${toast.body ?? ''}${toast.actionLabel ? ` ${toast.actionLabel}.` : ''}`}
          style={styles.bannerBody}
          feedback="dim"
        >
          <View style={[styles.dot, { backgroundColor: urgent ? colors.yellow : colors.navy2 }]}>
            <Icon
              name={urgent ? 'notifications' : 'checkmark'}
              size={16}
              color={urgent ? colors.navy : colors.white}
            />
          </View>
          <View style={styles.text}>
            <Text variant="bodyStrong" color={colors.white}>
              {toast.title}
            </Text>
            {toast.body ? (
              <Text variant="caption" color={colors.textOnDarkMuted} numberOfLines={2}>
                {toast.body}
              </Text>
            ) : null}
            {toast.actionLabel ? (
              <Text variant="captionStrong" color={colors.yellow}>
                {toast.actionLabel} →
              </Text>
            ) : null}
          </View>
        </Touchable>
        <IconButton icon="close" label="Dismiss" onPress={() => dismiss(toast.id)} tone="onDark" />
      </View>
    </View>
  );
}

/** A slim strip while offline, so cached content is never mistaken for live. */
export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      testID="offline-banner"
      accessibilityLiveRegion="polite"
      style={[styles.offline, { paddingBottom: insets.bottom > 0 ? spacing.xs : spacing.sm }]}
    >
      <Icon name="cloud-offline-outline" size={16} color={colors.navy} />
      <Text variant="captionStrong" color={colors.navy}>
        You’re offline — showing saved information where it’s safe to
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 20 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  info: { backgroundColor: colors.navy2 },
  urgent: { backgroundColor: colors.navy },
  bannerBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.yellow,
  },
});
