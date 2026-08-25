import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Order } from '@/types';
import { useMenu } from '@/features/menu/hooks';
import { useCartStore } from '@/store/cartStore';
import { describeReorder, planReorder } from './reorder';

/**
 * "Order again", once, for both places that offer it.
 *
 * The two implementations had drifted: the Orders list dropped unavailable
 * items without a word, and when nothing at all could be re-added it neither
 * navigated nor said anything — the button simply did nothing.
 *
 * A tap always produces something now: the basket, or an explanation.
 */
export function useReorder(): (order: Order) => void {
  const router = useRouter();
  const menu = useMenu();
  const addLine = useCartStore((state) => state.addLine);

  return useCallback(
    (order: Order) => {
      // The menu is what decides this, so without it there is no answer to
      // give. Saying so beats a button that looks broken.
      if (!menu.data) {
        Alert.alert('One moment', 'We are still loading the menu — try again in a second.');
        return;
      }

      const plan = planReorder(order.lines, menu.data.products);
      const notice = describeReorder(plan);

      if (plan.addable.length === 0) {
        // Nothing came back. Never silent, and never a trip to an empty cart.
        Alert.alert(
          notice?.title ?? 'Nothing to reorder',
          notice?.message ?? 'None of these items are on the menu right now.',
        );
        return;
      }

      for (const { product, line } of plan.addable) {
        addLine(product, line.selectedOptions, line.quantity, line.specialInstructions);
      }

      if (notice) {
        Alert.alert(notice.title, notice.message, [
          { text: 'View cart', onPress: () => router.push('/cart') },
        ]);
        return;
      }

      router.push('/cart');
    },
    [menu.data, addLine, router],
  );
}
