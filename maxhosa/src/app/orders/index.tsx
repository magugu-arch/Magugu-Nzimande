import { useCallback } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { Group, GroupTitle, Row } from '@/components/List';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/States';
import { useOrders, useProducts } from '@/features/catalogue';

export default function Orders() {
  const orders = useOrders();
  const products = useProducts();
  const { retry } = orders;
  useFocusEffect(useCallback(() => retry(), [retry]));
  return (
    <Screen title="Orders">
      {orders.status === 'loading' ? <LoadingSkeleton rows={1} /> : null}
      {orders.status === 'error' ? <ErrorState onRetry={orders.retry} /> : null}
      {orders.data && !orders.data.length ? (
        <EmptyState
          icon="cube-outline"
          title="No orders yet"
          body="Orders you place in this demo appear here. None are real."
        />
      ) : null}
      {orders.data?.length ? (
        <>
          <GroupTitle>Sample orders on this device</GroupTitle>
          <Group>
            {orders.data.map((o, i) => {
              const first = products.data?.find((p) => p.id === o.lines[0]?.productId);
              const count = o.lines.reduce((n, l) => n + l.quantity, 0);
              return (
                <Row
                  key={o.id}
                  first={i === 0}
                  title={o.id}
                  subtitle={`${count} ${count === 1 ? 'item' : 'items'} · sample order`}
                  leading={
                    first ? (
                      <View style={{ width: 44 }}>
                        <AssetImage
                          assetId={first.media[0]!.assetId}
                          decorative
                          style={{ aspectRatio: 4 / 5, borderRadius: 6 }}
                        />
                      </View>
                    ) : null
                  }
                  onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } })}
                />
              );
            })}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}
