import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { locateAddress } from '@/providers/geocoding';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { AccountRequired, useIsSignedOut } from '@/features/system/AccountRequired';
import { colors, spacing } from '@/theme';
import { required, validateFields, validatePostalCode } from '@/utils/validation';
import { ask, tell } from '@/ux/dialog';
import { writeFailureMessage } from '@/features/system/writeFailure';

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
  /*
    A save that did not save. Separate from `errors`, which are about what the
    customer typed — this one is about the server, and clearing it on the next
    keystroke would hide a failure they have not addressed.
  */
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);

  const update = useCallback((field: Field, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  /*
    Chosen, and then somewhere to go.

    `router.back()` alone assumes somebody arrived here from checkout. A deep
    link, a push notification, and a browser refresh on the web build all open
    this screen with nothing behind it, and `canGoBack()` is then false — so
    the address was set, the tap did nothing visible, and the customer was left
    looking at the list they had just answered. `audit:back` drove it: "the app
    recorded the choice and left the customer on /checkout/address with no sign
    it had."

    `/checkout` rather than home, which is where `checkout/store.tsx` sends
    them: that screen also serves somebody just browsing branches, and these
    two only exist to answer a question checkout asked. A customer who arrives
    here with no basket meets checkout's own empty state, which is a screen
    that explains itself.
  */
  const handleSelect = useCallback(
    (address: Address) => {
      setAddress(address);
      if (router.canGoBack()) router.back();
      else router.replace('/checkout');
    },
    [setAddress, router],
  );

  const handleDelete = useCallback(
    async (address: Address) => {
      const confirmed = await ask({
        title: 'Remove this address?',
        message: `${address.label} — ${address.line1}`,
        confirmLabel: 'Remove',
        cancelLabel: 'Keep it',
        destructive: true,
      });
      if (!confirmed) return;

      /*
        Two things were wrong here, and the second is the expensive one.

        It said nothing when the delete was refused — the address stayed in the
        list with no explanation. And it cleared the basket's delivery address
        *unconditionally*, before knowing whether anything had been deleted. So
        a refused delete left the customer with the address still on file and
        their order no longer going anywhere: a failure that took something
        away rather than leaving things as they were.

        The local clear now happens on success only. On an unreachable write
        the address is left selected, which is the safe side of a guess: the
        delete may well have gone through, and the checkout screen re-checks
        the address against the saved list anyway.
      */
      deleteAddress.mutate(address.id, {
        onSuccess: () => {
          if (selectedAddress?.id === address.id) setAddress(null);
        },
        onError: (error) => {
          const said = writeFailureMessage(error, 'remove that address');
          void tell(said.title, said.message);
        },
      });
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
     * Located if anything can locate it, and saved without coordinates if not.
     *
     * These six fields are all the app is given. New addresses used to be
     * anchored to the city centre "so distance maths stays sane", which was
     * true right up until the delivery-radius rule started doing distance
     * maths on it: measured from the Johannesburg CBD, six of the seven
     * branches sit outside their own radius, so every address anybody typed
     * was refused by six of them and accepted by the seventh, wherever in the
     * country it actually was.
     *
     * `locateAddress` is the lookup that was missing, behind the boundary a
     * real provider plugs into. It returns a coordinate only for an *exact*
     * match and `null` for everything else — an approximate fix, an address it
     * does not know, a provider that is down. So absent coordinates remain the
     * normal case and remain the honest record, and `deliveryRange` still
     * reads them as "unknown" rather than as a place.
     *
     * Nothing about saving an address depends on this succeeding. The lookup
     * cannot fail the form.
     */
    const located = await locateAddress({
      line1: form.line1.trim(),
      ...(form.line2.trim().length > 0 ? { line2: form.line2.trim() } : {}),
      suburb: form.suburb.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      postalCode: form.postalCode.trim(),
    });

    /*
      Caught, which it was not — the same defect as the contact form, on the
      checkout path.

      `mutateAsync` rejects when the save fails, and this file had no `catch`
      in it at all. So the rejection went unhandled, `setAddress`, `setForm`
      and `setAdding(false)` never ran, and the customer was left looking at a
      form they had just filled in completely, with no error and no
      confirmation — having typed a street address to get dinner delivered.

      Found by this round's own fixture rather than by the sweep: fixture 10
      asserts that the writes which were already handled stay handled, and
      this file turned out not to be one of them.
    */
    let created;
    try {
      created = await createAddress.mutateAsync({
        label: form.label.trim(),
        line1: form.line1.trim(),
        ...(form.line2.trim().length > 0 ? { line2: form.line2.trim() } : {}),
        suburb: form.suburb.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        postalCode: form.postalCode.trim(),
        ...(located ? { latitude: located.latitude, longitude: located.longitude } : {}),
        isDefault: makeDefault,
      });
    } catch (error) {
      const said = writeFailureMessage(error, 'save that address');
      setSaveFailure(`${said.title}. ${said.message}`);
      return;
    }

    setSaveFailure(null);
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
              // Outside the card's pressable region rather than inside it: a
              // delete button within a selectable card is a `<button>` inside a
              // `<button>` on web, and two controls at one spot to a reader.
              trailing={
                selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : (
                  <Pressable
                    onPress={() => handleDelete(address)}
                    testID={`address-delete-${address.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${address.label}`}
                    // A 19pt bin icon that deletes a saved address. `hitSlop` of
                    // 10 made it 39x41 on a handset and left it 19x21 on the web
                    // build; padding makes the box itself 45 and the negative
                    // margin keeps the row where it was. Worth more care than
                    // most: this is the smallest target in the app and one of
                    // the few that destroys something.
                    style={{ padding: 13, margin: -13 }}
                  >
                    <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
                  </Pressable>
                )
              }
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
              testID="address-field-label"
              error={errors.label ?? null}
              placeholder="Home, Work, Mom's place"
              required
            />
            <TextField
              label="Street address"
              value={form.line1}
              onChangeText={(text) => update('line1', text)}
              testID="address-field-line1"
              error={errors.line1 ?? null}
              placeholder="14 Acacia Road"
              autoComplete="street-address"
              required
            />
            <TextField
              label="Complex, unit or floor"
              value={form.line2}
              onChangeText={(text) => update('line2', text)}
              testID="address-field-line2"
              placeholder="Unit 3 (optional)"
            />
            <TextField
              label="Suburb"
              value={form.suburb}
              onChangeText={(text) => update('suburb', text)}
              testID="address-field-suburb"
              error={errors.suburb ?? null}
              placeholder="Melrose Arch"
              required
            />

            <View style={styles.row}>
              <TextField
                label="City"
                value={form.city}
                onChangeText={(text) => update('city', text)}
                testID="address-field-city"
                error={errors.city ?? null}
                placeholder="Johannesburg"
                containerStyle={styles.rowField}
                required
              />
              <TextField
                label="Postal code"
                value={form.postalCode}
                onChangeText={(text) => update('postalCode', text)}
                testID="address-field-postalCode"
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
              testID="address-field-province"
              error={errors.province ?? null}
              placeholder="Gauteng"
              required
            />

            <Toggle
              label="Make this my default address"
              value={makeDefault}
              onValueChange={setMakeDefault}
            />

            {saveFailure ? (
              <View
                style={styles.saveFailure}
                accessibilityRole="alert"
                testID="address-save-failed"
              >
                <Ionicons name="alert-circle" size={17} color={colors.status.error} />
                <Text variant="caption" color={colors.status.error} style={styles.saveFailureText}>
                  {saveFailure}
                </Text>
              </View>
            ) : null}

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
  saveFailure: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  saveFailureText: { flex: 1 },
  body: { gap: spacing.md, paddingBottom: spacing.xxxl },
  addressHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  addressTitles: { flex: 1, gap: spacing.xxs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  instructionsBlock: { paddingTop: spacing.sm },
  form: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  rowField: { flex: 1 },
});
