'use client';

import { MAX_BASKET_LINES, MAX_LINE_QUANTITY } from '@bbq/types';
import type { OrderTotals, PublicOrder, ServiceMode, Store } from '@bbq/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { lineKey, type CartLine } from '@/lib/cart';
import { totalsFor } from '@/lib/pricing';
import { promotionFor } from '@/lib/promotions';

const STORAGE_KEY = 'bbq.ordering.v1';

type Persisted = {
  mode: ServiceMode;
  storeId: string;
  lines: CartLine[];
  promoCode: string | null;
  orders: PublicOrder[];
};

type OrderingValue = {
  mode: ServiceMode;
  storeId: string;
  store: Store;
  stores: readonly Store[];
  lines: CartLine[];
  promoCode: string | null;
  totals: OrderTotals;
  itemCount: number;
  /** Set once the provider has read localStorage, so nothing renders twice. */
  hydrated: boolean;
  orders: PublicOrder[];
  setMode: (mode: ServiceMode) => void;
  setStore: (storeId: string) => void;
  addLine: (line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  applyPromo: (code: string) => { ok: boolean; message: string };
  clearPromo: () => void;
  recordOrder: (order: PublicOrder) => void;
  announce: (message: string) => void;
  announcement: string;
};

const OrderingContext = createContext<OrderingValue | null>(null);

export function useOrdering(): OrderingValue {
  const value = useContext(OrderingContext);
  if (!value) throw new Error('useOrdering must be used inside OrderingProvider');
  return value;
}

function readPersisted(): Partial<Persisted> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : null;
  } catch {
    // A private window or blocked storage is not a reason to fail the basket.
    return null;
  }
}

export function OrderingProvider({
  stores,
  promoCodes,
  children,
}: {
  stores: readonly Store[];
  /** Valid codes, resolved server side so the client cannot mint its own. */
  promoCodes: readonly string[];
  children: ReactNode;
}) {
  const fallbackStore = stores[0];
  if (!fallbackStore) throw new Error('The ordering provider needs at least one store');

  const [mode, setModeState] = useState<ServiceMode>('Delivery');
  const [storeId, setStoreId] = useState<string>(fallbackStore.id);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    /* Reading the basket back out of localStorage is the one-time
       synchronisation with an external store that effects exist for. It cannot
       be lazy initial state: the server has no localStorage, so seeding from it
       during the first render would contradict the markup the server sent.
       These writes batch into a single render, and run once. */
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = readPersisted();
    if (saved) {
      if (saved.mode) setModeState(saved.mode);
      if (saved.storeId && stores.some((store) => store.id === saved.storeId)) {
        setStoreId(saved.storeId);
      }
      if (Array.isArray(saved.lines)) setLines(saved.lines);
      if (saved.promoCode) setPromoCode(saved.promoCode);
      if (Array.isArray(saved.orders)) setOrders(saved.orders);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [stores]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: Persisted = { mode, storeId, lines, promoCode, orders };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage being unavailable must not break the journey in progress.
    }
  }, [hydrated, mode, storeId, lines, promoCode, orders]);

  const store = useMemo(
    () => stores.find((candidate) => candidate.id === storeId) ?? fallbackStore,
    [stores, storeId, fallbackStore],
  );

  const announce = useCallback((message: string) => {
    // Cleared first so an identical consecutive message is still announced.
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(message), 60);
  }, []);

  /**
   * Store service rules are enforced as the customer switches. Waterfall Ridge
   * has dine-in off, so choosing it while in dine-in moves the order to
   * collection rather than leaving an order the store cannot accept.
   */
  const setStore = useCallback(
    (nextId: string) => {
      const next = stores.find((candidate) => candidate.id === nextId);
      if (!next) return;
      setStoreId(nextId);
      if (!next.services[mode]) {
        setModeState('Collection');
        announce(`${next.name} is not taking ${mode.toLowerCase()} orders. Switched to collection.`);
      }
    },
    [stores, mode, announce],
  );

  const setMode = useCallback(
    (nextMode: ServiceMode) => {
      if (!store.services[nextMode]) {
        announce(`${store.name} is not taking ${nextMode.toLowerCase()} orders.`);
        return;
      }
      setModeState(nextMode);
      announce(`Switched to ${nextMode.toLowerCase()}.`);
    },
    [store, announce],
  );

  /**
   * The same bounds the server enforces, met here first.
   *
   * Not a second opinion: the schema refuses an order past either limit and is
   * the authority. This is so a customer holding the plus button meets a
   * stepper that stops rather than a 400 at checkout, three screens after the
   * thing they did wrong.
   */
  const addLine = useCallback(
    (line: Omit<CartLine, 'key'>) => {
      const key = lineKey(line.slug, line.options);

      /**
       * The message is worked out here, from `lines`, rather than inside the
       * updater below.
       *
       * It has to say what actually happened — "added" is wrong when the basket
       * was already at the limit — and only the basket knows. The updater knows
       * too, but it does not run at this line: React defers it, so a variable
       * set inside it still holds its old value by the time `announce` is
       * reached. Reading the rendered basket is a frame behind under very fast
       * repeated clicks, which can misword one announcement; the state itself
       * is still updated functionally below and stays exact.
       */
      const existing = lines.find((candidate) => candidate.key === key);
      const atLineLimit = existing !== undefined && existing.quantity >= MAX_LINE_QUANTITY;
      const atBasketLimit = existing === undefined && lines.length >= MAX_BASKET_LINES;

      setLines((current) => {
        const held = current.find((candidate) => candidate.key === key);
        if (held) {
          const capped = Math.min(held.quantity + line.quantity, MAX_LINE_QUANTITY);
          return current.map((candidate) =>
            candidate.key === key ? { ...candidate, quantity: capped } : candidate,
          );
        }
        if (current.length >= MAX_BASKET_LINES) return current;
        return [
          ...current,
          { ...line, quantity: Math.min(line.quantity, MAX_LINE_QUANTITY), key },
        ];
      });

      if (atLineLimit) {
        announce(`Your basket already holds the most we can take of ${line.name} in one order.`);
      } else if (atBasketLimit) {
        announce(
          `A basket holds ${MAX_BASKET_LINES} different items. Ring the store for a larger order.`,
        );
      } else {
        announce(`${line.quantity} ${line.name} added to your basket.`);
      }
    },
    [announce, lines],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      setLines((current) => {
        if (quantity < 1) {
          const removed = current.find((line) => line.key === key);
          if (removed) announce(`${removed.name} removed from your basket.`);
          return current.filter((line) => line.key !== key);
        }
        const capped = Math.min(quantity, MAX_LINE_QUANTITY);
        return current.map((line) => (line.key === key ? { ...line, quantity: capped } : line));
      });
    },
    [announce],
  );

  const removeLine = useCallback((key: string) => setQuantity(key, 0), [setQuantity]);

  const clearCart = useCallback(() => {
    setLines([]);
    setPromoCode(null);
  }, []);

  const applyPromo = useCallback(
    (code: string) => {
      const normalised = code.trim().toUpperCase();
      if (!normalised) return { ok: false, message: 'Enter a promo code.' };
      if (!promoCodes.includes(normalised)) {
        return { ok: false, message: 'That code is not valid.' };
      }
      setPromoCode(normalised);
      announce(`Promo code ${normalised} applied.`);
      return { ok: true, message: `${normalised} applied.` };
    },
    [promoCodes, announce],
  );

  const clearPromo = useCallback(() => setPromoCode(null), []);

  const recordOrder = useCallback((order: PublicOrder) => {
    setOrders((current) => [order, ...current.filter((candidate) => candidate.id !== order.id)]);
  }, []);

  /**
   * The basket's own view of the offer.
   *
   * Checks the conditions a browser can check — the day, the time and the
   * fulfilment mode. It cannot check whether this is a customer's first order,
   * so it shows that offer as applying and lets the server be the authority:
   * the order route refuses with the offer's own wording, which the checkout
   * screen displays. Hiding the offer from everybody instead would be worse.
   */
  const promotion = useMemo(() => {
    const result = promotionFor(promoCode, { mode, isFirstOrder: true });
    return result.ok ? result.promotion : null;
  }, [promoCode, mode]);

  const totals = useMemo(() => totalsFor(lines, mode, promotion), [lines, mode, promotion]);
  const itemCount = useMemo(
    () => lines.reduce((count, line) => count + line.quantity, 0),
    [lines],
  );

  const value: OrderingValue = {
    mode,
    storeId,
    store,
    stores,
    lines,
    promoCode,
    totals,
    itemCount,
    hydrated,
    orders,
    setMode,
    setStore,
    addLine,
    setQuantity,
    removeLine,
    clearCart,
    applyPromo,
    clearPromo,
    recordOrder,
    announce,
    announcement,
  };

  return (
    <OrderingContext.Provider value={value}>
      {children}
      {/* Basket and order-status changes are announced here. One region for the
          whole app, so announcements queue rather than compete. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </OrderingContext.Provider>
  );
}
