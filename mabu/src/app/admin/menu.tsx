import { useState } from 'react';
import { View } from 'react-native';
import { AdminScreen, NumberField } from '@/components/admin/Admin';
import {
  Card,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Segmented,
  Text,
  ToggleRow,
} from '@/components/ui';
import type { Dish, WineItem } from '@/domain/menu/types';
import { formatRand } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';

/** §18 Menu & Wine CMS: price and availability changes live, no store release. */
export default function AdminMenu() {
  const menu = useRpc('content.menu');
  const [tab, setTab] = useState<'food' | 'wine'>('food');
  return (
    <AdminScreen title="Menu & wine" adminOnly>
      <View style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'food', label: 'Dishes' },
            { value: 'wine', label: 'Wines' },
          ]}
        />
      </View>
      {!menu.data ? (
        <LoadingBlock />
      ) : tab === 'food' ? (
        menu.data.dishes.map((d) => <DishRow key={d.id} dish={d} />)
      ) : (
        menu.data.wines.map((w) => <WineRow key={w.id} wine={w} />)
      )}
    </AdminScreen>
  );
}

function DishRow({ dish }: { dish: Dish }) {
  const [d, setD] = useState(dish);
  const save = useRpcMutation('admin.menu.saveDish', [
    'content.menu',
    'content.dish',
    'content.home',
  ]);
  const dirty = d.priceCents !== dish.priceCents || d.available !== dish.available;
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <ToggleRow
        label={d.name}
        description={`${d.category} · ${d.available ? 'available' : 'sold out'}`}
        value={d.available}
        onChange={(available) => setD({ ...d, available })}
      />
      <NumberField
        label="Price (R)"
        value={d.priceCents / 100}
        onChange={(v) => setD({ ...d, priceCents: v * 100 })}
        hint={formatRand(d.priceCents)}
      />
      {dirty ? (
        <PremiumButton
          label="Publish"
          compact
          loading={save.isPending}
          onPress={() => save.mutate(d)}
        />
      ) : null}
      {save.isError ? <InlineNotice tone="danger">{errorMessage(save.error)}</InlineNotice> : null}
      {save.isSuccess && !dirty ? (
        <Text variant="caption" color="success">
          Published.
        </Text>
      ) : null}
    </Card>
  );
}

function WineRow({ wine }: { wine: WineItem }) {
  const [w, setW] = useState(wine);
  const save = useRpcMutation('admin.menu.saveWine', ['content.menu', 'content.wine']);
  const dirty = JSON.stringify(w) !== JSON.stringify(wine);
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <ToggleRow
        label={`${w.producer} ${w.name}`}
        description={w.varietal}
        value={w.available}
        onChange={(available) => setW({ ...w, available })}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Glass (R)"
            value={(w.glassPriceCents ?? 0) / 100}
            onChange={(v) => setW({ ...w, glassPriceCents: v ? v * 100 : undefined })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Bottle (R)"
            value={w.bottlePriceCents / 100}
            onChange={(v) => setW({ ...w, bottlePriceCents: v * 100 })}
          />
        </View>
      </View>
      {dirty ? (
        <PremiumButton
          label="Publish"
          compact
          loading={save.isPending}
          onPress={() => save.mutate(w)}
        />
      ) : null}
      {save.isError ? <InlineNotice tone="danger">{errorMessage(save.error)}</InlineNotice> : null}
    </Card>
  );
}
