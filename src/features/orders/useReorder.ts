import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { Order } from '@/types';
import { useMenu } from '@/features/menu/hooks';
import { useCartStore } from '@/store/cartStore';
import { describeReorder, planReorder } from './reorder';
import { ask, tell } from '@/ux/dialog';

/**
 * "Order again", once, for both places that offer it.
 *
 * The two implementations had drifted: the Orders list dropped unavailable
 * items without a word, and when nothing at all could be re-added it neither
 * navigated nor said anything — the button simply did nothing.
 *
 * A tap always produces something now: the basket, or an explanation.
 */
export function useReorder(): (order: Order) => Promise<void> {
  const router = useRouter();
  const menu = useMenu();
  const addLine = useCartStore((state) => state.addLine);

  return useCallback(
    async (order: Order) => {
      // The menu is what decides this, so without it there is no answer to
      // give. Saying so beats a button that looks broken.
      if (!menu.data) {
        void tell('One moment', 'We are still loading the menu — try again in a second.');
        return;
      }

      const plan = planReorder(order.lines, menu.data.products);
      const notice = describeReorder(plan);

      if (plan.addable.length === 0) {
        // Nothing came back. Never silent, and never a trip to an empty cart.
        void tell(
          notice?.title ?? 'Nothing to reorder',
          notice?.message ?? 'None of these items are on the menu right now.',
        );
        return;
      }

      for (const { product, line } of plan.addable) {
        addLine(product, line.selectedOptions, line.quantity, line.specialInstructions);
      }

      if (notice) {
        // Substitutions are worth reading before the basket is opened, so the
        // customer decides when to move on rather than arriving to a cart that
        // quietly differs from the order they tapped.
        await ask({
          title: notice.title,
          message: notice.message,
          confirmLabel: 'View cart',
          cancelLabel: 'Not now',
        }).then((view) => {
          if (view) router.push('/cart');
        });
        return;
      }

      router.push('/cart');
    },
    [menu.data, addLine, router],
  );
}
