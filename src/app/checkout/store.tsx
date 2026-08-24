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

  // Ask once, on first visit. Denial is fine — we fall back to the default centre.
  useEffect(() => {
    if (!permissionAsked && !coordinates) void requestLocation();
  }, [permissionAsked, coordinates, requestLocation]);

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
    if (stores.isLoading) return <LoadingState message="Finding stores near you…" />;
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
          message={`We don't have a store offering ${fulfilmentType === 'dinein' ? 'dine-in' : fulfilmentType} near you yet. Try another option.`}
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

            {status === 'denied' ? (
              <View style={styles.locationNotice}>
                <Text variant="caption" color={colors.textSecondary}>
                  Location is off, so we&apos;re showing stores from the city centre. Turn it on for
                  accurate distances.
                </Text>
                <Button
                  label="Use my location"
                  onPress={() => void requestLocation()}
                  variant="text"
                  fullWidth={false}
                  size="sm"
                />
              </View>
            ) : null}

            <Text variant="h3">
              {list.length} store{list.length === 1 ? '' : 's'} nearby
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
