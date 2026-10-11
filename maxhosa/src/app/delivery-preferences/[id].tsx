import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { PressableScale } from '@/components/PressableScale';
import { SheetScaffold } from '@/components/SheetScaffold';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { canChangeDelivery } from '@/domain/delivery';
import type { DeliveryPreference } from '@/domain/types';
import { useTracking } from '@/features/tracking';
import { providers } from '@/providers';

const PLACES: [DeliveryPreference['place'], string, string][] = [
  ['door', 'Hand it to me', 'A signature may be needed'],
  ['reception', 'Leave it at reception', 'Building or office reception'],
  ['neighbour', 'Leave with a neighbour', 'The courier notes who has it'],
  ['safe-place', 'Leave in a safe place', 'Describe it below'],
];

/**
 * A change request is not saved because it was sent: this waits for the
 * courier to acknowledge it, and refuses once the courier's cut-off has passed.
 */
export default function DeliveryPreferences() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tracking } = useTracking(id);
  const { colors } = useTheme();
  const [place, setPlace] = useState<DeliveryPreference['place']>(
    tracking?.preference?.place ?? 'door',
  );
  const [notes, setNotes] = useState(tracking?.preference?.instructions ?? '');
  const [phase, setPhase] = useState<'edit' | 'sending' | 'acknowledged' | 'refused'>('edit');
  const [error, setError] = useState('');

  if (tracking && !canChangeDelivery(tracking) && phase === 'edit') {
    return (
      <SheetScaffold title="Delivery preferences">
        <Callout icon="time-outline" title="Changes are closed for this delivery.">
          The courier is already on the way. Client care can still help.
        </Callout>
      </SheetScaffold>
    );
  }

  const send = async () => {
    setPhase('sending');
    try {
      await providers.delivery.requestPreference(id, {
        place,
        instructions: notes.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('acknowledged');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The courier didn’t accept the change.');
      setPhase('refused');
    }
  };

  return (
    <SheetScaffold
      title="Delivery preferences"
      footer={
        phase === 'acknowledged' || phase === 'refused' ? (
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
        ) : (
          <Button
            label={phase === 'sending' ? 'Sending to the courier…' : 'Send to courier'}
            busy={phase === 'sending'}
            onPress={() => void send()}
          />
        )
      }
    >
      {phase === 'acknowledged' ? (
        <Callout icon="checkmark-circle-outline" title="Courier accepted the change">
          Simulated acknowledgement. In production this appears only after the courier confirms.
        </Callout>
      ) : phase === 'refused' ? (
        <Callout icon="alert-circle-outline" title="Not changed">
          {error}
        </Callout>
      ) : (
        <View style={{ gap: space.s }}>
          <Text variant="footnote" color="ink3">
            Options depend on what the courier supports in your market. This demo shows the common
            set.
          </Text>
          <View accessibilityRole="radiogroup" style={{ gap: space.s }}>
            {PLACES.map(([key, title, sub]) => (
              <PressableScale
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: place === key }}
                onPress={() => setPlace(key)}
                style={[
                  styles.choice,
                  {
                    backgroundColor: colors.paper,
                    borderColor: place === key ? colors.ink : colors.hairline,
                    borderWidth: place === key ? 2 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="callout" weight="600">
                    {title}
                  </Text>
                  <Text variant="footnote" color="ink3">
                    {sub}
                  </Text>
                </View>
                {place === key ? <Ionicons name="checkmark" size={20} color={colors.ink} /> : null}
              </PressableScale>
            ))}
          </View>
          <Text variant="footnote" weight="700" color="ink2" style={{ marginTop: space.m }}>
            Instructions for the courier (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            maxLength={140}
            multiline
            placeholder="e.g. Gate code at reception"
            placeholderTextColor={colors.ink3}
            accessibilityLabel="Instructions for the courier"
            style={[styles.input, { backgroundColor: colors.sunk, color: colors.ink }]}
          />
          <Text variant="footnote" color="ink3">
            Avoid personal details — instructions are shared with the courier.
          </Text>
        </View>
      )}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.l,
    borderRadius: radius.m,
  },
  input: {
    minHeight: 80,
    borderRadius: 12,
    padding: space.m,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
