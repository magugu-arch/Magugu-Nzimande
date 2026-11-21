import { formatStamp, type PlacementLabel, type SourceMeta } from '@scarlets/domain';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useL, useLocale, useT, type MessageKey } from '@/i18n';
import { radius, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** Marks seeded demo data. It appears wherever demo data does. */
export function DemoChip({ onDark, label }: { onDark?: boolean; label?: string }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: onDark ? theme.goldOnInverse : theme.goldText,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        variant="eyebrow"
        color={onDark ? 'goldOnInverse' : 'goldText'}
        style={{ fontSize: 10, lineHeight: 13 }}
      >
        {label ?? t('demo')}
      </Text>
    </View>
  );
}

export interface TagProps {
  label: string;
  icon?: IconName;
  tone?: 'neutral' | 'accent' | 'gold' | 'success' | 'warning' | 'onDark';
  style?: StyleProp<ViewStyle>;
}

export function Tag({ label, icon, tone = 'neutral', style }: TagProps) {
  const theme = useTheme();
  const look = {
    neutral: { bg: theme.surfaceMuted, fg: theme.textSecondary },
    accent: { bg: theme.accent, fg: theme.onAccent },
    gold: { bg: theme.surfaceMuted, fg: theme.goldText },
    success: { bg: theme.surfaceMuted, fg: theme.success },
    warning: { bg: theme.surfaceMuted, fg: theme.warning },
    onDark: { bg: 'rgba(246,242,236,0.16)', fg: theme.onInverse },
  }[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: space.sm,
          paddingVertical: 3,
          borderRadius: radius.pill,
          backgroundColor: look.bg,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={12} color={look.fg} /> : null}
      <Text variant="caption" style={{ color: look.fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

/** The visible label every commercial tile carries. */
export function PlacementTag({ label, onDark }: { label: PlacementLabel; onDark?: boolean }) {
  const t = useT();
  return (
    <Tag
      label={t(`label.${label}` as MessageKey)}
      icon="megaphone-outline"
      tone={onDark ? 'onDark' : 'gold'}
    />
  );
}

export interface DataStampProps {
  meta: SourceMeta;
  timeZone?: string;
  onDark?: boolean;
  /** Show the provider's notice underneath, when it has one. */
  showNotice?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The update state of whatever sits above it: current, delayed, stale,
 * unavailable or offline, with the time the provider last confirmed it. The
 * state is written out as well as coloured, and demo data always says so.
 */
export function DataStamp({
  meta,
  timeZone = 'Europe/London',
  onDark,
  showNotice,
  style,
}: DataStampProps) {
  const theme = useTheme();
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const time = meta.updatedAt ? formatStamp(meta.updatedAt, timeZone, locale) : null;
  const text =
    meta.status === 'unavailable'
      ? t('status.unavailable')
      : meta.status === 'offline'
        ? time
          ? t('status.offline', { time })
          : t('status.offlineNoTime')
        : time
          ? t(`status.${meta.status}` as MessageKey, { time })
          : t('status.unavailable');
  const dot =
    meta.status === 'current'
      ? theme.success
      : meta.status === 'delayed' || meta.status === 'stale'
        ? theme.warning
        : onDark
          ? theme.onInverseMuted
          : theme.textSecondary;
  const icon: IconName =
    meta.status === 'offline'
      ? 'cloud-offline-outline'
      : meta.status === 'unavailable'
        ? 'remove-circle-outline'
        : meta.status === 'current'
          ? 'checkmark-circle'
          : 'time-outline';
  return (
    <View
      style={style}
      accessible
      accessibilityLabel={`${meta.demo ? `${t('demo')}. ` : ''}${text}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        {meta.demo ? <DemoChip onDark={onDark} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon
            name={icon}
            size={13}
            color={onDark && meta.status === 'current' ? '#7DDBA8' : dot}
          />
          <Text variant="caption" color={onDark ? 'onInverseMuted' : 'textSecondary'} numeric>
            {text}
          </Text>
        </View>
      </View>
      {showNotice && meta.notice ? (
        <Text
          variant="footnote"
          color={onDark ? 'onInverseMuted' : 'textSecondary'}
          style={{ marginTop: space.xs }}
        >
          {l(meta.notice)}
        </Text>
      ) : null}
    </View>
  );
}
