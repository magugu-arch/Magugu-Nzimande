import { useEffect } from 'react';
import { ScrollView, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { springs, useReducedMotion } from '@/lib/motion';
import { hitTarget, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';

/** A row of filter pills. One is always selected. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{ marginHorizontal: -space.xl, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Press
            key={option.id}
            testID={testID ? `${testID}-${option.id}` : undefined}
            onPress={() => {
              if (selected) return;
              haptic.selection();
              onChange(option.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            hitSlop={4}
            style={{
              minHeight: 36,
              paddingHorizontal: space.lg,
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: selected ? theme.text : theme.surface,
            }}
          >
            <Text
              variant="footnote"
              style={{ color: selected ? theme.bg : theme.text, fontWeight: '600' }}
            >
              {option.label}
            </Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

/** A tick box that fills on a spring the moment it is pressed. */
export function CheckMark({ checked, size = 26 }: { checked: boolean; size?: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    progress.set(reduced ? (checked ? 1 : 0) : withSpring(checked ? 1 : 0, springs.press));
  }, [checked, progress, reduced]);
  const fill = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + 0.4 * progress.value }],
  }));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: checked ? theme.accent : theme.textSecondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
          },
          fill,
        ]}
      >
        <Icon name="checkmark" size={size * 0.62} color={theme.onAccent} />
      </Animated.View>
    </View>
  );
}

export function CheckRow({
  checked,
  onToggle,
  title,
  detail,
  testID,
  style,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  detail?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press
      testID={testID}
      onPress={() => {
        haptic.selection();
        onToggle();
      }}
      scaleTo={0.985}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.md,
          minHeight: hitTarget,
          paddingVertical: space.sm,
        },
        style,
      ]}
    >
      <CheckMark checked={checked} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline" style={{ textDecorationLine: 'none' }}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" color="textSecondary">
            {detail}
          </Text>
        ) : null}
      </View>
    </Press>
  );
}

/** Plus and minus around a figure. Buttons, not a drag: every step is one press. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  moreLabel,
  lessLabel,
  testID,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  moreLabel: string;
  lessLabel: string;
  testID?: string;
}) {
  const theme = useTheme();
  const button = (delta: number, icon: 'add' | 'remove', a11y: string) => {
    const next = Math.min(max, Math.max(min, value + delta));
    return (
      <Press
        testID={testID ? `${testID}-${icon}` : undefined}
        onPress={() => {
          if (next === value) return;
          haptic.selection();
          onChange(next);
        }}
        disabled={next === value}
        accessibilityLabel={a11y}
        style={{
          width: hitTarget,
          height: hitTarget,
          borderRadius: hitTarget / 2,
          backgroundColor: theme.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color={theme.text} />
      </Press>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text variant="headline" numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      {button(-1, 'remove', lessLabel)}
      <Text
        testID={testID ? `${testID}-value` : undefined}
        variant="title1"
        numeric
        accessibilityLabel={`${label}: ${value}`}
        style={{ minWidth: 44, textAlign: 'center' }}
      >
        {value}
      </Text>
      {button(1, 'add', moreLabel)}
    </View>
  );
}

/** The platform switch in the working palette, with a haptic on the change itself. */
export function Toggle({
  value,
  onChange,
  label,
  testID,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  testID?: string;
}) {
  const theme = useTheme();
  // The web build names the "on" thumb colour separately.
  const web = { activeThumbColor: '#FFFFFF' } as object;
  return (
    <Switch
      testID={testID}
      value={value}
      onValueChange={(next) => {
        haptic.selection();
        onChange(next);
      }}
      accessibilityLabel={label}
      trackColor={{ true: theme.accent, false: theme.scheme === 'dark' ? '#4A4246' : '#CFC8BE' }}
      thumbColor="#FFFFFF"
      {...web}
    />
  );
}
