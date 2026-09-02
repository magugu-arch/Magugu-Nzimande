import { useQuery } from '@tanstack/react-query';
import type { Address, DeliveryQuote, FulfilmentType, Store } from '@/types';
import { deliveryProvider } from '@/providers/delivery';
import { reportError } from '@/ux/errorReporting';
import { queryKeys } from '@/services/queryKeys';

/**
 * Asking the courier network whether it will actually go there.
 *
 * The app already has a serviceability rule: each branch carries a
 * `deliveryRadiusKm`, and `missingFulfilmentRequirement` refuses an address
 * measured outside it. That answers "will bb.q deliver this far", which is a
 * different question from "will a courier take this job" — and only the second
 * one is answered by the people who actually drive. An order can clear the
 * radius and still have no courier willing to collect it, which is the
 * `FAILED` case the provider mapping already has to handle.
 *
 * `quote()` is on the interface because the brief specifies it (§5). This is
 * what calls it. An interface method nothing invokes is a promise about a
 * boundary rather than a boundary.
 *
 * ── What may and may not stop an order ─────────────────────────────────────
 * Three outcomes, and only one of them blocks:
 *
 *   refused, address located     → block. No courier will come, so taking the
 *                                  money would sell somebody food that cannot
 *                                  reach them.
 *   refused, address not located → **do not block.** The provider is refusing
 *                                  because the app never geocoded the address,
 *                                  which is the app's own open gap and is
 *                                  already named in `audit:launch`. Refusing a
 *                                  delivery over it would turn a known
 *                                  limitation into a lost order. This is the
 *                                  same rule `deliveryRange` already applies:
 *                                  an address nobody has located is let
 *                                  through.
 *   provider unreachable         → **do not block.** A courier network being
 *                                  down is not a reason to stop taking orders;
 *                                  `attachDelivery` takes the same line. The
 *                                  failure is reported, not shown.
 */
export function courierRefusal(quote: DeliveryQuote, addressIsLocated: boolean): string | null {
  if (quote.serviceable) return null;
  // Not located is the app's gap, not the courier's refusal. See above.
  if (!addressIsLocated) return null;
  return 'No driver covers that address right now — collect instead, or try again shortly';
}

export function addressIsLocated(address: Address | null): boolean {
  return Boolean(address && address.latitude !== undefined && address.longitude !== undefined);
}

export interface CourierServiceability {
  /** A reason to refuse the order, or null. Null while the answer is unknown. */
  refusal: string | null;
  checking: boolean;
}

/**
 * The quote, fetched when there is something to quote.
 *
 * Only for delivery, only with a store and an address, and only when the
 * address has coordinates — a provider cannot answer for a dropoff nobody has
 * located, and asking anyway spends a call to be told what is already known.
 *
 * Through TanStack Query rather than an effect, for the reason every other
 * fetch in this app goes through it: the cache dedupes the call across
 * re-renders, a reply for an address the customer has since changed is
 * discarded by the key rather than by a flag somebody has to remember to
 * check, and there is no state to set in an effect.
 */
export function useCourierServiceability(
  fulfilmentType: FulfilmentType,
  store: Store | null,
  address: Address | null,
  orderValue: number,
): CourierServiceability {
  const located = addressIsLocated(address);
  const storeId = store?.id;
  const latitude = address?.latitude;
  const longitude = address?.longitude;
  const enabled = fulfilmentType === 'delivery' && storeId !== undefined && located;

  const quote = useQuery({
    queryKey: queryKeys.courierQuote(storeId, latitude, longitude, orderValue),
    enabled,
    // A courier quote is perishable — the provider stamps its own expiry — so
    // it is not held warm the way a menu is.
    staleTime: 60_000,
    retry: 1,
    queryFn: () =>
      deliveryProvider().quote({
        storeId: storeId as string,
        ...(latitude !== undefined ? { dropoffLatitude: latitude } : {}),
        ...(longitude !== undefined ? { dropoffLongitude: longitude } : {}),
        orderValue,
      }),
  });

  if (quote.error) {
    // Reported, not shown, and never a refusal. A courier network being
    // unreachable must not stop an order the kitchen can still cook —
    // `attachDelivery` takes the same line.
    reportError(quote.error, { scope: 'courier-quote' });
  }

  return {
    refusal: quote.data ? courierRefusal(quote.data, true) : null,
    checking: enabled && quote.isPending,
  };
}
