import { useCallback, useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Store } from '@/types';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { isOfflinePending } from '@/features/system/queryPhase';
import { FulfilmentSelector } from '@/features/home/components/FulfilmentSelector';
import { StoreCard } from '@/features/stores/components/StoreCard';
import { StoreMapPreview } from '@/features/stores/components/StoreMapPreview';
import { useDeviceLocation, useStoresForFulfilment } from '@/features/stores/hooks';
import { useCartStore } from '@/store/cartStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { colors, spacing } from '@/theme';

/** Store Selection + Store Locator (brief §4 / §11). */
export default function StoreSelectionScreen() {
  const router = useRouter();

  const fulfilmentType = useFulfilmentStore((state) => state.fulfilmentType);
  const setFulfilmentType = useFulfilmentStore((state) => state.setFulfilmentType);
  const selectedStore = useFulfilmentStore((state) => state.store);
  const setStore = useFulfilmentStore((state) => state.setStore);
  const coordinates = useFulfilmentStore((state) => state.coordinates);
  const permissionAsked = useFulfilmentStore((state) => state.locationPermissionAsked);
  const setCartFulfilment = useCartStore((state) => state.setFulfilmentType);

  const { status, requestLocation } = useDeviceLocation();
  const stores = useStoresForFulfilment(fulfilmentType);

  // Ask once, on first visit. Denial is fine — the list simply carries no
  // distances, rather than distances measured from somewhere else.
  useEffect(() => {
    if (!permissionAsked && !coordinates) void requestLocation();
  }, [permissionAsked, coordinates, requestLocation]);

  /**
   * Whether this list can say how far anything is.
   *
   * Not the same question as `status === 'denied'`, which is what the notice
   * below used to key off. `status` describes *this visit*: a customer who
   * declined during onboarding comes back with `status` at 'idle' and
   * `permissionAsked` already true, so the effect above does not ask again and
   * the notice never appeared — leaving the one control that could turn
   * location back on unreachable for exactly the person who needed it.
   */
  const located = coordinates !== null;

  const handleSelect = useCallback(
    (store: Store) => {
      setStore(store);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/home');
    },
    [setStore, router],
  );

  const handleFulfilmentChange = useCallback(
    (next: typeof fulfilmentType) => {
      setFulfilmentType(next);
      setCartFulfilment(next);
    },
    [setFulfilmentType, setCartFulfilment],
  );

  const renderBody = () => {
    if (stores.isLoading) {
      return <LoadingState message={located ? 'Finding stores near you…' : 'Finding stores…'} />;
    }
    // Offline is not empty and not broken. Without this the screen falls
    // through to a factual claim it cannot back up.
    if (isOfflinePending(stores)) return <OfflineState onRetry={() => void stores.refetch()} />;
    if (stores.isError) return <ErrorState onRetry={() => void stores.refetch()} />;

    const list = stores.data ?? [];
    if (list.length === 0) {
      return (
        <EmptyState
          icon="storefront-outline"
          title="No stores available"
          // "Near you" is the same claim the badges were making. With no
          // coordinates the app is not reporting an absence of nearby stores,
          // it is reporting an absence of stores.
          message={`We don't have a store offering ${
            fulfilmentType === 'dinein' ? 'dine-in' : fulfilmentType
          }${located ? ' near you' : ''} yet. Try another option.`}
        />
      );
    }

    return (
      <FlatList
        data={list}
        keyExtractor={(store) => store.id}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            selected={item.id === selectedStore?.id}
            onPress={() => handleSelect(item)}
            fulfilmentType={fulfilmentType}
            testID={`store-card-${item.id}`}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <StoreMapPreview
              stores={list}
              origin={coordinates}
              selectedStoreId={selectedStore?.id}
              onSelectStore={handleSelect}
            />

            {located ? null : (
              <View style={styles.locationNotice}>
                {/*
                  This used to read "we're showing stores from the city centre",
                  which was true and was the bug: the list was measured, sorted
                  and badged from the Johannesburg CBD whoever was holding the
                  phone. It now carries no distances at all, so this says what
                  is missing rather than what was substituted for it.
                */}
                <Text variant="caption" color={colors.textSecondary}>
                  Location is off, so we can&apos;t tell how far each store is. These are listed
                  alphabetically — turn location on to sort them by distance.
                </Text>
                <Button
                  label={status === 'requesting' ? 'Asking…' : 'Use my location'}
                  onPress={() => void requestLocation()}
                  variant="text"
                  fullWidth={false}
                  size="sm"
                  disabled={status === 'requesting'}
                />
              </View>
            )}

            {/* "Nearby" is a claim about distance, so only make it when there is one. */}
            <Text variant="h3">
              {list.length} store{list.length === 1 ? '' : 's'}
              {located ? ' nearby' : ''}
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']} testID="store-selection-screen">
      <View style={styles.header}>
        <ScreenHeader title="Choose a store" />
        <FulfilmentSelector value={fulfilmentType} onChange={handleFulfilmentChange} compact />
      </View>

      <View style={styles.body}>{renderBody()}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  body: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  listHeader: { gap: spacing.lg, marginBottom: spacing.lg },
  locationNotice: { gap: spacing.xs },
  gap: { height: spacing.md },
});
