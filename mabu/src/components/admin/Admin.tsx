import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';
import { EmptyState, Header, Screen, Text, TextField } from '../ui';

/**
 * Wraps every admin screen. Hiding a screen is courtesy only — every admin
 * RPC checks the role on the server — but a guest should never see a
 * half-rendered staff screen full of permission errors.
 */
export function AdminScreen({
  title,
  children,
  adminOnly,
  footer,
}: {
  title: string;
  children: ReactNode;
  adminOnly?: boolean;
  footer?: ReactNode;
}) {
  const role = useSession((s) => s.actor?.role);
  const allowed = adminOnly ? role === 'admin' : role === 'admin' || role === 'staff';
  return (
    <Screen header={<Header title={title} />} footer={allowed ? footer : undefined}>
      {allowed ? (
        children
      ) : (
        <EmptyState
          icon="lock"
          title={adminOnly ? 'Admin only' : 'Staff only'}
          body="Sign in with a restaurant account to use this area."
          action="Back"
          onAction={() => router.back()}
        />
      )}
    </Screen>
  );
}

export function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'warning' | 'danger';
}) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="h2" color={tone ?? 'accent'}>
        {value}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

export function TileRow({ children }: { children: ReactNode }) {
  return <View style={styles.tiles}>{children}</View>;
}

/** A labelled whole-number field that reports a number or null. */
export function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <TextField
      label={label}
      value={Number.isFinite(value) ? String(value) : ''}
      onChangeText={(t) => onChange(Number(t.replace(/[^\d-]/g, '') || 0))}
      keyboardType="number-pad"
      hint={hint}
    />
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
