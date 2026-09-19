import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCampaigns } from '@/services/rewardsService';
import { useOrders } from '@/features/orders/hooks';
import { useAuthStore } from '@/store/authStore';
import { useNow } from '@/features/system/useNow';
import { headlineSpecial, type MarketingAudience } from './specials';

/**
 * The campaigns, with their targeting still attached.
 *
 * Cached for five minutes like the public promotion list: a special is not
 * time-critical to the minute, and refetching on every screen would cost a
 * customer data to be told the same thing.
 */
export function useCampaigns() {
  return useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Consent, read from the store rather than a query.
 *
 * Both preference blocks live in `authStore` — they are persisted to the
 * handset and pushed to the server, not fetched from it — so reading them
 * here means a customer switching "Promotions" off sees the special
 * disappear on the next render rather than after a cache expiry.
 */
export function useMarketingConsent() {
  const preferences = useAuthStore((state) => state.preferences);
  const notifications = useAuthStore((state) => state.notificationPreferences);
  return { preferences, notifications };
}

/**
 * What the engine knows about this customer, derived from their orders.
 *
 * Read from the order history rather than asked of a backend segmentation
 * service, because the four segments this app uses are all answerable from
 * it. A real campaign tool would compute these server-side; the shapes are
 * the same either way, so swapping the source changes this function and
 * nothing downstream.
 *
 * Birthday is `false` until somebody captures a date of birth. The profile
 * has no such field, so a birthday campaign is correctly never eligible —
 * which is the honest state, and better than treating a missing birthday as
 * "today" and wishing everybody many happy returns at once.
 */
function audienceFrom(orders: { placedAt: string }[] | undefined): MarketingAudience {
  const history = orders ?? [];
  if (history.length === 0) {
    return {
      hasOrdered: false,
      recentOrderCount: 0,
      daysSinceLastOrder: null,
      isBirthday: false,
    };
  }

  const now = Date.now();
  const times = history
    .map((order) => Date.parse(order.placedAt))
    .filter((time) => Number.isFinite(time));

  const mostRecent = times.length > 0 ? Math.max(...times) : null;
  const ninetyDaysAgo = now - 90 * 86_400_000;

  return {
    hasOrdered: true,
    recentOrderCount: times.filter((time) => time >= ninetyDaysAgo).length,
    daysSinceLastOrder: mostRecent === null ? null : Math.floor((now - mostRecent) / 86_400_000),
    isBirthday: false,
  };
}

/**
 * The one special to put on a single surface, or null.
 *
 * Null is the common answer and the correct one: no consent, nothing in
 * window, nothing aimed at this person, or too soon since the last message.
 * The caller renders nothing rather than a placeholder — an empty slot where
 * a special would go is worse than no slot, because it advertises that the
 * restaurant has nothing on.
 *
 * `lastSentAt` is null here: this app has no send log, because it does not
 * send anything yet — push is registered and waiting on a project id. The
 * cap is therefore evaluated and always passes, which is the right
 * behaviour for an in-app surface a customer chose to open. It becomes
 * load-bearing the moment a real send log exists, and the gate is already
 * wired for it.
 */
export function useHeadlineSpecial() {
  const campaigns = useCampaigns();
  const orders = useOrders();
  const { preferences, notifications } = useMarketingConsent();
  const now = useNow();

  return useMemo(() => {
    if (!campaigns.data) return null;

    return headlineSpecial({
      specials: campaigns.data,
      audience: audienceFrom(orders.data),
      preferences,
      notifications,
      lastSentAt: null,
      now,
    });
  }, [campaigns.data, orders.data, preferences, notifications, now]);
}
