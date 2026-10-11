import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { EXCEPTION_LABEL } from '@/domain/delivery';
import type { DeliveryExceptionKind } from '@/domain/types';
import { Button } from '../Button';
import { Text } from '../Text';

export type RecoveryAction =
  'redelivery' | 'safe-place' | 'check-address' | 'client-care' | 'courier-page';

const COPY: Partial<
  Record<DeliveryExceptionKind, { text: string; actions: [RecoveryAction, string][] }>
> = {
  delayed: {
    text: 'The courier has reported a delay. There is no new estimate yet — it will appear as soon as the courier sends one.',
    actions: [
      ['courier-page', 'Courier tracking page'],
      ['client-care', 'Contact client care'],
    ],
  },
  address_issue: {
    text: 'The courier could not match the delivery address. Confirm it so they can try again.',
    actions: [
      ['check-address', 'Check address'],
      ['client-care', 'Contact client care'],
    ],
  },
  delivery_attempted: {
    text: 'The courier came by and nobody was available to receive the parcel.',
    actions: [
      ['redelivery', 'Arrange redelivery'],
      ['safe-place', 'Choose a safe place'],
      ['client-care', 'Contact client care'],
    ],
  },
  customs_hold: {
    text: 'The parcel is waiting for customs clearance. Clearance times are set by customs, so there is no date to show yet.',
    actions: [
      ['client-care', 'Ask about customs'],
      ['courier-page', 'Courier tracking page'],
    ],
  },
  returned_to_sender: {
    text: 'The parcel is on its way back to MAXHOSA AFRICA. Client care will contact you about a refund or a resend.',
    actions: [['client-care', 'Contact client care']],
  },
};

/** An exception is not a red warning and nothing else: it says what happened and what you can do. */
export function ExceptionRecoveryCard({
  kind,
  onAction,
}: {
  kind: DeliveryExceptionKind;
  onAction: (a: RecoveryAction) => void;
}) {
  const { colors } = useTheme();
  const copy = COPY[kind];
  if (!copy) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.rustSoft }]} accessibilityRole="alert">
      <View style={styles.head}>
        <Ionicons name="warning-outline" size={18} color={colors.rust} />
        <Text variant="headline" color="rust">
          {EXCEPTION_LABEL[kind]}
        </Text>
      </View>
      <Text variant="subhead" color="ink2" style={{ marginBottom: space.m }}>
        {copy.text}
      </Text>
      <View style={styles.actions}>
        {copy.actions.map(([id, label], i) => (
          <Button
            key={id}
            label={label}
            variant={i === 0 ? 'primary' : 'secondary'}
            onPress={() => onAction(id)}
            style={styles.button}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.gutter,
    marginTop: space.l,
    padding: space.l,
    borderRadius: radius.m,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginBottom: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  button: { minHeight: 40, paddingHorizontal: space.l },
});
