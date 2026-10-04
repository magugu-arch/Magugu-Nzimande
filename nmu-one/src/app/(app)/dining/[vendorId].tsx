import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { DietaryTag, MenuItem } from '@/core/domain/models';
import { formatMoney } from '@/core/domain/money';
import { useMenu, useVendors } from '@/data/hooks';
import {
  Button,
  Card,
  ChipRow,
  Header,
  IconButton,
  Notice,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  StateView,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { cartCount, cartTotal, quantityOf, useCart } from '@/features/dining/cart';

const DIETARY: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  halaal: 'Halaal',
  'gluten-free': 'Gluten-free',
  'contains-nuts': 'Contains nuts',
};

type Filter = 'all' | 'vegetarian' | 'vegan' | 'halaal' | 'gluten-free';

/** A vendor's menu with dietary information (brief §9 "dietary information"). */
export default function VendorMenu() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const router = useRouter();
  const vendors = useVendors();
  const menu = useMenu(vendorId);
  const canOrder = useCan('commerce.order');
  const cart = useCart((s) => s.cart);
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const [filter, setFilter] = useState<Filter>('all');

  const vendor = vendors.data?.find((v) => v.id === vendorId);
  const otherVendorInCart = cart.vendorId && cart.vendorId !== vendorId;
  const count = cart.vendorId === vendorId ? cartCount(cart) : 0;

  const footer =
    count > 0 && canOrder ? (
      <Button
        label={`View order · ${count} item${count === 1 ? '' : 's'} · ${formatMoney(cartTotal(cart))}`}
        variant="accent"
        fullWidth
        onPress={() => router.push('/dining/cart')}
        testID="view-cart"
      />
    ) : undefined;

  return (
    <Screen
      header={<Header title={vendor?.name ?? 'Menu'} fallbackHref="/dining" />}
      footer={footer}
      testID="vendor-menu"
    >
      {vendor ? (
        <View style={styles.head}>
          <Text variant="title1" accessibilityRole="header">
            {vendor.name}
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {vendor.cuisine} · {vendor.pickupPoint}
          </Text>
          {!vendor.isOpen ? (
            <Notice
              tone="neutral"
              title="Closed right now"
              body={`Opening hours: ${vendor.hours.map((h) => `${h.days} ${h.open}–${h.close}`).join(', ')}. You can browse the menu; ordering opens when they do.`}
            />
          ) : null}
          {otherVendorInCart && vendor.isOpen ? (
            <Notice
              tone="info"
              title="You have an order started elsewhere"
              body="Adding from here starts a new order — each order is collected from one counter."
            />
          ) : null}
          {!canOrder ? (
            <Notice
              tone="neutral"
              title="Browsing only"
              body="Ordering isn’t part of NMU ONE for your role."
            />
          ) : null}
        </View>
      ) : null}

      <ChipRow<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Everything' },
          { value: 'vegetarian', label: 'Vegetarian' },
          { value: 'vegan', label: 'Vegan' },
          { value: 'halaal', label: 'Halaal' },
          { value: 'gluten-free', label: 'Gluten-free' },
        ]}
      />

      <View style={styles.menu}>
        <QueryState query={menu} what="the menu">
          {(items) => {
            const shown = items.filter((i) => filter === 'all' || i.dietary.includes(filter));
            if (!shown.length)
              return (
                <StateView
                  kind="empty"
                  title="Nothing matches"
                  body="Try another dietary filter."
                />
              );
            const categories = [...new Set(shown.map((i) => i.category))];
            return categories.map((cat) => (
              <View key={cat} style={{ marginBottom: spacing.lg }}>
                <SectionHeader title={cat} />
                <View style={{ gap: spacing.sm }}>
                  {shown
                    .filter((i) => i.category === cat)
                    .map((item) => (
                      <MenuRow
                        key={item.id}
                        item={item}
                        quantity={cart.vendorId === vendorId ? quantityOf(cart, item.id) : 0}
                        orderable={canOrder && !!vendor?.isOpen && !!vendor.acceptsOrders}
                        onAdd={() => add(item)}
                        onRemove={() => remove(item.id)}
                      />
                    ))}
                </View>
              </View>
            ));
          }}
        </QueryState>
      </View>
    </Screen>
  );
}

function MenuRow({
  item,
  quantity,
  orderable,
  onAdd,
  onRemove,
}: {
  item: MenuItem;
  quantity: number;
  orderable: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <Card testID={`item-${item.id}`}>
      <Row align="flex-start" gap={spacing.md}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{item.name}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {item.description}
          </Text>
          <Row wrap gap={spacing.xs} style={{ marginTop: spacing.xs }}>
            {item.dietary.map((d) => (
              <Pill
                key={d}
                label={DIETARY[d]}
                tone={d === 'contains-nuts' ? 'warning' : 'neutral'}
              />
            ))}
            {!item.available ? <Pill label="Sold out" tone="danger" /> : null}
          </Row>
        </View>
        <View style={styles.price}>
          <Text variant="bodyStrong">{formatMoney(item.price)}</Text>
          {orderable && item.available ? (
            quantity > 0 ? (
              <Row gap={spacing.xs}>
                <IconButton
                  icon="remove"
                  label={`Remove one ${item.name}`}
                  onPress={onRemove}
                  tone="filled"
                />
                <Text variant="bodyStrong" accessibilityLabel={`${quantity} in order`}>
                  {quantity}
                </Text>
                <IconButton
                  icon="add"
                  label={`Add another ${item.name}`}
                  onPress={onAdd}
                  tone="filled"
                  testID={`add-${item.id}`}
                />
              </Row>
            ) : (
              <Button
                label="Add"
                icon="add"
                size="md"
                variant="secondary"
                onPress={onAdd}
                testID={`add-${item.id}`}
                accessibilityHint={`Adds ${item.name} to your order`}
              />
            )
          ) : null}
        </View>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, marginBottom: spacing.lg },
  menu: { marginTop: spacing.lg },
  price: { alignItems: 'flex-end', gap: spacing.sm },
});
