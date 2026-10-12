import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { BagButton } from '@/components/HeaderActions';
import { MenuButton } from '@/components/MenuButton';
import { Group, GroupTitle, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { ProductCard } from '@/components/ProductCard';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';
import { Text } from '@/components/Text';
import { space } from '@/design/tokens';
import { useProducts } from '@/features/catalogue';
import { useSaved } from '@/store/saved';

export default function Saved() {
  const products = useProducts();
  const ids = useSaved((s) => s.productIds);
  const restock = useSaved((s) => s.restock);
  const removeRestock = useSaved((s) => s.removeRestock);
  const saved = ids.map((id) => products.data?.find((p) => p.id === id)).filter((p) => !!p);

  return (
    <Screen
      title="Saved"
      largeTitle
      subtitle={
        saved.length
          ? `${saved.length} ${saved.length === 1 ? 'piece' : 'pieces'} on this device`
          : undefined
      }
      inTabs
      left={<MenuButton />}
      right={<BagButton />}
    >
      {!saved.length ? (
        <EmptyState
          icon="heart-outline"
          title="Nothing saved yet"
          body="Tap the heart on any piece to keep it here. In this demo, saved pieces stay on this device."
          action={{ label: 'Browse the shop', onPress: () => router.navigate('/shop') }}
        />
      ) : (
        <View style={styles.grid}>
          {saved.map((p) => (
            <View key={p.id} style={styles.cell}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
      )}

      {restock.length ? (
        <>
          <GroupTitle>Restock requests</GroupTitle>
          <Group>
            {restock.map((r, i) => {
              const p = products.data?.find((x) => x.id === r.productId);
              return (
                <Row
                  key={`${r.productId}-${r.size}`}
                  first={i === 0}
                  icon="notifications-outline"
                  title={`${p?.name ?? r.productId} · ${r.size}`}
                  subtitle="Demo — no alert will be sent"
                  end={
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Remove request for ${p?.name ?? ''} ${r.size}`}
                      onPress={() => removeRestock(r)}
                      hitSlop={8}
                    >
                      <Text
                        variant="subhead"
                        weight="600"
                        color="ink2"
                        style={{ textDecorationLine: 'underline' }}
                      >
                        Remove
                      </Text>
                    </PressableScale>
                  }
                />
              );
            })}
          </Group>
        </>
      ) : null}

      <GroupTitle>Alerts</GroupTitle>
      <Group>
        <Row
          first
          icon="notifications-outline"
          title="Restock and collection alerts"
          subtitle="Off until you switch them on"
          onPress={() => router.push('/notifications')}
        />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.gutter,
    gap: space.m,
    rowGap: space.xl,
  },
  cell: { width: '47.5%' },
});
