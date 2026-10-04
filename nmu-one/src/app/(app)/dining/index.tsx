import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useOrders, useVendors } from '@/data/hooks';
import {
  Card,
  HeroBack,
  Icon,
  Pill,
  PhotoHero,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  Text,
  colors,
  radius,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';

/**
 * Campus commerce (brief §10, §26 step 8): a university-controlled ordering
 * channel. Vendors, hours and live open state; order ahead and collect.
 */
export default function Dining() {
  const router = useRouter();
  const vendors = useVendors();
  const canOrder = useCan('commerce.order');
  const orders = useOrders(canOrder);
  const active =
    orders.data?.filter((o) => ['placed', 'preparing', 'ready'].includes(o.status)) ?? [];

  return (
    <Screen padded={false} topInset={false} testID="dining">
      <PhotoHero
        photo="cafeteria"
        eyebrow="Food on campus"
        title="Order ahead. Skip the queue."
        subtitle="Pay in the app, collect at the counter."
        height={240}
        topBar={<HeroBack />}
      />
      <View style={styles.body}>
        {active.map((o) => (
          <Card
            key={o.id}
            tone={o.status === 'ready' ? 'yellow' : 'surface'}
            onPress={() => router.push(`/dining/order/${o.id}`)}
            accessibilityLabel={`Your order from ${o.vendorName}: ${o.status === 'ready' ? 'ready for pickup' : 'in progress'}. Code ${o.pickupCode}.`}
          >
            <Row gap={spacing.md}>
              <Icon
                name={o.status === 'ready' ? 'bag-check' : 'time-outline'}
                size={24}
                color={colors.navy}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">
                  {o.status === 'ready' ? 'Ready for pickup' : 'Order in progress'}
                </Text>
                <Text variant="caption">
                  {o.vendorName} · code {o.pickupCode}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.navy} />
            </Row>
          </Card>
        ))}

        <SectionHeader title="South Campus" />
        <QueryState query={vendors} what="campus vendors">
          {(list) => (
            <View style={{ gap: spacing.md }}>
              {[...list]
                .sort((a, b) => Number(b.isOpen) - Number(a.isOpen))
                .map((v) => (
                  <Card
                    key={v.id}
                    onPress={() => router.push(`/dining/${v.id}`)}
                    accessibilityLabel={`${v.name}, ${v.cuisine}. ${v.isOpen ? `Open, ready in about ${v.prepMinutes} minutes` : 'Closed now'}.`}
                    testID={`vendor-${v.id}`}
                  >
                    <Row gap={spacing.md} align="flex-start">
                      <View style={[styles.mark, !v.isOpen ? styles.markClosed : null]}>
                        <Icon
                          name="restaurant"
                          size={22}
                          color={v.isOpen ? colors.navy : colors.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Row justify="space-between">
                          <Text variant="title3">{v.name}</Text>
                          <Pill
                            label={v.isOpen ? 'Open' : 'Closed'}
                            tone={v.isOpen ? 'success' : 'neutral'}
                          />
                        </Row>
                        <Text variant="caption" color={colors.textSecondary}>
                          {v.cuisine}
                        </Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {v.hours.map((h) => `${h.days} ${h.open}–${h.close}`).join(' · ')}
                        </Text>
                        {v.isOpen && v.acceptsOrders ? (
                          <Text variant="captionStrong" color={colors.navy2}>
                            Ready in about {v.prepMinutes} min · {v.pickupPoint}
                          </Text>
                        ) : null}
                      </View>
                    </Row>
                  </Card>
                ))}
            </View>
          )}
        </QueryState>
        <Text variant="caption" color={colors.textSecondary}>
          Prices are set by each vendor. Payment goes through the university’s approved provider.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter, gap: spacing.lg },
  mark: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markClosed: { backgroundColor: colors.surfaceSunken },
});
