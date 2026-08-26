import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { Address } from '@/types';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  LoadingState,
  OfflineState,
  Screen,
  ScreenHeader,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { isOfflinePending } from '@/features/system/queryPhase';
import { useAddresses, useCreateAddress, useDeleteAddress } from '@/features/account/hooks';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { AccountRequired, useIsSignedOut } from '@/features/system/AccountRequired';
import { colors, spacing } from '@/theme';
import { required, validateFields, validatePostalCode } from '@/utils/validation';

type Field = 'label' | 'line1' | 'line2' | 'suburb' | 'city' | 'province' | 'postalCode';

const EMPTY_FORM: Record<Field, string> = {
  label: '',
  line1: '',
  line2: '',
  suburb: '',
  city: '',
  province: '',
  postalCode: '',
};

/** Address Selection + Delivery Instructions (brief §4). */
export default function AddressScreen() {
  const signedOut = useIsSignedOut();
  const router = useRouter();

  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const deleteAddress = useDeleteAddress();

  const selectedAddress = useFulfilmentStore((state) => state.address);
  const setAddress = useFulfilmentStore((state) => state.setAddress);
  const deliveryInstructions = useFulfilmentStore((state) => state.deliveryInstructions);
  const setDeliveryInstructions = useFulfilmentStore((state) => state.setDeliveryInstructions);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<Field, string>>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [makeDefault, setMakeDefault] = useState(false);

  const update = useCallback((field: Field, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const handleSelect = useCallback(
    (address: Address) => {
      setAddress(address);
      if (router.canGoBack()) router.back();
    },
    [setAddress, router],
  );

  const handleDelete = useCallback(
    (address: Address) => {
      Alert.alert('Remove this address?', `${address.label} — ${address.line1}`, [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteAddress.mutate(address.id);
            if (selectedAddress?.id === address.id) setAddress(null);
          },
        },
      ]);
    },
    [deleteAddress, selectedAddress, setAddress],
  );

  const handleSave = useCallback(async () => {
    const validationErrors = validateFields(form, {
      label: required('Label'),
      line1: required('Street address'),
      suburb: required('Suburb'),
      city: required('City'),
      province: required('Province'),
      postalCode: validatePostalCode,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    /**
     * Saved without coordinates, because nobody has any.
     *
     * These six fields are all the app is given and there is no geocoder
     * behind them. New addresses used to be anchored to the city centre "so
     * distance maths stays sane", which was true right up until the
     * delivery-radius rule started doing distance maths on it: measured from
     * the Johannesburg CBD, six of the seven branches sit outside their own
     * radius, so every address anybody typed was refused by six of them and
     * accepted by the seventh, wherever in the country it actually was.
     *
     * Leaving them absent is the honest record, and `deliveryRange` reads it
     * as "unknown" rather than as a place. Whatever geocodes this — the
     * backend on POST, or a lookup wired in here — fills the fields in and the
     * radius rule starts working on real distances without further change.
     */
    const created = await createAddress.mutateAsync({
      label: form.label.trim(),
      line1: form.line1.trim(),
      ...(form.line2.trim().length > 0 ? { line2: form.line2.trim() } : {}),
      suburb: form.suburb.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      postalCode: form.postalCode.trim(),
      isDefault: makeDefault,
    });

    setAddress(created);
    setForm(EMPTY_FORM);
    setMakeDefault(false);
    setAdding(false);
  }, [form, makeDefault, createAddress, setAddress]);

  // The app offers "Continue as guest" and then brought them here, to a screen
  // made entirely of account data. Only Profile ever checked.
  if (signedOut) {
    return (
      <AccountRequired
        title="Delivery address"
        message="Sign in to save an address, so you only type it once."
        icon="location-outline"
        testID="address-signed-out"
      />
    );
  }

  if (addresses.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Delivery address" />
        <LoadingState />
      </Screen>
    );
  }

  // Offline is not empty and not broken. Without this the screen falls

  // through to a factual claim it cannot back up.

  if (isOfflinePending(addresses)) {
    return <OfflineState onRetry={() => void addresses.refetch()} />;
  }

  if (addresses.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Delivery address" />
        <ErrorState onRetry={() => void addresses.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="address-screen">
      <ScreenHeader title="Delivery address" />

      <View style={styles.body}>
        {(addresses.data ?? []).map((address) => {
          const selected = address.id === selectedAddress?.id;
          return (
            <Card
              key={address.id}
              onPress={() => handleSelect(address)}
              selected={selected}
              accessibilityLabel={`${address.label}, ${address.line1}, ${address.suburb}`}
              testID={`address-card-${address.id}`}
            >
              <View style={styles.addressHeader}>
                <View style={styles.addressTitles}>
                  <View style={styles.labelRow}>
                    <Text variant="h3">{address.label}</Text>
                    {address.isDefault ? <Badge label="Default" tone="neutral" /> : null}
                  </View>
                  <Text variant="caption" color={colors.textSecondary}>
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {address.suburb}, {address.city}, {address.postalCode}
                  </Text>
                </View>

                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : (
                  <Pressable
                    onPress={() => handleDelete(address)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${address.label}`}
                  >
                    <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            </Card>
          );
        })}

        {/* Delivery instructions apply to whichever address is selected */}
        {selectedAddress ? (
          <View style={styles.instructionsBlock}>
            <TextField
              label="Delivery instructions"
              value={deliveryInstructions}
              onChangeText={setDeliveryInstructions}
              placeholder="Gate code, which buzzer, where to leave it…"
              helperText="Your driver sees this on their app."
              iconLeft="chatbubble-ellipses-outline"
              multiline
              testID="delivery-instructions"
            />
          </View>
        ) : null}

        <Divider spacingSize="sm" />

        {adding ? (
          <View style={styles.form}>
            <Text variant="h3">New address</Text>

            <TextField
              label="Label"
              value={form.label}
              onChangeText={(text) => update('label', text)}
              error={errors.label ?? null}
              placeholder="Home, Work, Mom's place"
              required
            />
            <TextField
              label="Street address"
              value={form.line1}
              onChangeText={(text) => update('line1', text)}
              error={errors.line1 ?? null}
              placeholder="14 Acacia Road"
              autoComplete="street-address"
              required
            />
            <TextField
              label="Complex, unit or floor"
              value={form.line2}
              onChangeText={(text) => update('line2', text)}
              placeholder="Unit 3 (optional)"
            />
            <TextField
              label="Suburb"
              value={form.suburb}
              onChangeText={(text) => update('suburb', text)}
              error={errors.suburb ?? null}
              placeholder="Melrose Arch"
              required
            />

            <View style={styles.row}>
              <TextField
                label="City"
                value={form.city}
                onChangeText={(text) => update('city', text)}
                error={errors.city ?? null}
                placeholder="Johannesburg"
                containerStyle={styles.rowField}
                required
              />
              <TextField
                label="Postal code"
                value={form.postalCode}
                onChangeText={(text) => update('postalCode', text)}
                error={errors.postalCode ?? null}
                placeholder="2196"
                keyboardType="number-pad"
                maxLength={4}
                containerStyle={styles.rowField}
                required
              />
            </View>

            <TextField
              label="Province"
              value={form.province}
              onChangeText={(text) => update('province', text)}
              error={errors.province ?? null}
              placeholder="Gauteng"
              required
            />

            <Toggle
              label="Make this my default address"
              value={makeDefault}
              onValueChange={setMakeDefault}
            />

            <Button
              label="Save address"
              onPress={() => void handleSave()}
              loading={createAddress.isPending}
              size="lg"
              testID="address-save"
            />
            <Button label="Cancel" onPress={() => setAdding(false)} variant="text" />
          </View>
        ) : (
          <Button
            label="Add a new address"
            onPress={() => setAdding(true)}
            variant="tertiary"
            iconLeft="add"
            testID="address-add"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingBottom: spacing.xxxl },
  addressHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  addressTitles: { flex: 1, gap: spacing.xxs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  instructionsBlock: { paddingTop: spacing.sm },
  form: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  rowField: { flex: 1 },
});
