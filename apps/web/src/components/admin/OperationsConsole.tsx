'use client';

import {
  ORDER_STATES,
  SERVICE_MODES,
  type Product,
  type Promotion,
  type Store,
} from '@bbq/types';
import { useCallback, useEffect, useState } from 'react';
import { Price } from '@/components/ui/Price';
import type { AuditEntry } from '@/lib/catalogue-state';

type QueueOrder = {
  id: string;
  orderNumber: string;
  mode: string;
  status: string;
  statusLabel: string;
  placedAt: string;
  totals: { totalCents: number };
  lines: { name: string; quantity: number }[];
  kitchenNote: string;
};

const TABS = ['Orders', 'Menu', 'Stores', 'Promotions', 'Audit'] as const;
type Tab = (typeof TABS)[number];

/**
 * A session lasts a shift, so it can lapse with the console still open on a
 * pass counter. Every call runs through this: without it a 401 was swallowed
 * and the operator went on reading a queue frozen at the moment their session
 * ended, with each write quietly failing.
 */
function endedSession(response: Response): boolean {
  if (response.status !== 401 && response.status !== 503) return false;
  window.location.assign('/admin/login');
  return true;
}

export function OperationsConsole({
  initialProducts,
  initialStores,
  initialOrders,
  initialAudit,
  initialHidden,
  promotions,
}: {
  initialProducts: readonly Product[];
  initialStores: readonly Store[];
  initialOrders: readonly QueueOrder[];
  initialAudit: readonly AuditEntry[];
  initialHidden: readonly string[];
  promotions: readonly Promotion[];
}) {
  const [tab, setTab] = useState<Tab>('Orders');
  const [products, setProducts] = useState<readonly Product[]>(initialProducts);
  const [hiddenSlugs, setHiddenSlugs] = useState<readonly string[]>(initialHidden);
  const [stores, setStores] = useState<readonly Store[]>(initialStores);
  // Seeded from the server render, so the queue is on screen at first paint and
  // the effect below only has to keep it current.
  const [orders, setOrders] = useState<readonly QueueOrder[]>(initialOrders);
  const [audit, setAudit] = useState<readonly AuditEntry[]>(initialAudit);
  const [busy, setBusy] = useState(false);

  const refreshQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/orders');
      if (endedSession(response)) return;
      if (!response.ok) return;
      const data = (await response.json()) as { orders: QueueOrder[]; audit: AuditEntry[] };
      setOrders(data.orders);
      setAudit(data.audit);
    } catch {
      // A failed refresh leaves the last good queue on screen.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refreshQueue, 15_000);
    return () => window.clearInterval(timer);
  }, [refreshQueue]);

  async function setAvailability(slug: string, patch: { soldOut?: boolean; hidden?: boolean }) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, ...patch }),
      });
      if (endedSession(response)) return;
      if (response.ok) {
        const data = (await response.json()) as { products: Product[]; hidden: string[] };
        setProducts(data.products);
        setHiddenSlugs(data.hidden);
        await refreshQueue();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleService(storeId: string, mode: string, enabled: boolean) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeId, mode, enabled }),
      });
      if (endedSession(response)) return;
      if (response.ok) {
        const data = (await response.json()) as { stores: Store[] };
        setStores(data.stores);
        await refreshQueue();
      }
    } finally {
      setBusy(false);
    }
  }

  async function moveOrder(orderId: string, status: string) {
    const reason =
      status === 'cancelled'
        ? window.prompt('Why is this order being cancelled?')?.trim()
        : undefined;
    if (status === 'cancelled' && !reason) return;

    setBusy(true);
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, status, reason }),
      });
      if (endedSession(response)) return;
      if (response.ok) {
        const data = (await response.json()) as { orders: QueueOrder[]; audit: AuditEntry[] };
        setOrders(data.orders);
        setAudit(data.audit);
      }
    } finally {
      setBusy(false);
    }
  }

  // Hidden products are absent from the catalogue response, so the console has
  // to merge them back in to offer a control that restores them.
  const allProducts = [
    ...products,
    ...initialProducts.filter((product) => hiddenSlugs.includes(product.slug)),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div role="tablist" aria-label="Operations sections" className="flex flex-wrap gap-2">
        {TABS.map((candidate) => (
          <button
            key={candidate}
            role="tab"
            type="button"
            aria-selected={tab === candidate}
            onClick={() => setTab(candidate)}
            className={[
              'rounded-full px-4 py-2 text-[13px] font-bold transition-colors',
              tab === candidate ? 'bg-black text-white' : 'bg-white text-black hover:bg-paper',
            ].join(' ')}
          >
            {candidate}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel" aria-label={tab}>
        {tab === 'Orders' && (
          <section>
            <h2 className="display text-2xl">Order queue</h2>
            {orders.length === 0 ? (
              <p className="mt-4 rounded-md border border-line bg-white p-8 text-center text-sm text-muted">
                Nothing in the queue. Place an order on the storefront and it appears here.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {orders.map((order) => (
                  <li key={order.id} className="rounded-md border border-line bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="tabular text-sm font-extrabold">{order.orderNumber}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {order.mode} ·{' '}
                          {new Date(order.placedAt).toLocaleTimeString('en-ZA', {
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                      <span className="rounded-full bg-paper px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]">
                        {order.statusLabel}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted">
                      {order.lines.map((line) => `${line.quantity}× ${line.name}`).join(', ')}
                    </p>

                    {order.kitchenNote && (
                      <p className="mt-2 rounded-sm bg-yellow/20 px-3 py-2 text-xs">
                        <span className="font-bold">Kitchen note:</span> {order.kitchenNote}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <Price cents={order.totals.totalCents} className="text-sm font-extrabold" />
                      <div className="flex flex-wrap gap-1.5">
                        {ORDER_STATES.filter(
                          (state) => order.mode === 'Delivery' || state !== 'out_for_delivery',
                        ).map((state) => (
                          <button
                            key={state}
                            type="button"
                            disabled={busy || order.status === state}
                            onClick={() => moveOrder(order.id, state)}
                            className={[
                              'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                              order.status === state
                                ? 'bg-red text-white'
                                : 'bg-paper hover:bg-black-10 disabled:opacity-40',
                            ].join(' ')}
                          >
                            {state.replace(/_/g, ' ')}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={busy || order.status === 'cancelled'}
                          onClick={() => moveOrder(order.id, 'cancelled')}
                          className="rounded-full border border-red px-2.5 py-1 text-[11px] font-bold text-red transition-colors hover:bg-red-10 disabled:opacity-40"
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'Menu' && (
          <section>
            <h2 className="display text-2xl">Menu availability</h2>
            <p className="mt-1 max-w-[60ch] text-sm text-muted">
              Sold out keeps an item on the menu and blocks it at the basket. Hidden removes it
              from the catalogue entirely.
            </p>
            <div className="mt-4 overflow-x-auto rounded-md border border-line bg-white">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-left">
                    <th scope="col" className="px-4 py-3 text-xs font-bold uppercase">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold uppercase">
                      Sold out
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold uppercase">
                      Hidden
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {allProducts.map((product) => {
                    const hidden = hiddenSlugs.includes(product.slug);
                    return (
                      <tr key={product.slug}>
                        <th scope="row" className="px-4 py-2.5 text-left font-bold">
                          {product.name}
                        </th>
                        <td className="px-4 py-2.5">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={product.soldOut}
                              disabled={busy}
                              onChange={(event) =>
                                setAvailability(product.slug, { soldOut: event.target.checked })
                              }
                              className="size-4 accent-red"
                            />
                            <span className="sr-only">Mark {product.name} sold out</span>
                          </label>
                        </td>
                        <td className="px-4 py-2.5">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={hidden}
                              disabled={busy}
                              onChange={(event) =>
                                setAvailability(product.slug, { hidden: event.target.checked })
                              }
                              className="size-4 accent-red"
                            />
                            <span className="sr-only">Hide {product.name} from the menu</span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'Stores' && (
          <section>
            <h2 className="display text-2xl">Service switches</h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {stores.map((store) => (
                <li key={store.id} className="rounded-md border border-line bg-white p-5">
                  <h3 className="text-sm font-extrabold">{store.name}</h3>
                  <p className="mt-0.5 text-xs text-muted">{store.address}</p>
                  <ul className="mt-4 space-y-2">
                    {SERVICE_MODES.map((mode) => (
                      <li key={mode} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{mode}</span>
                        <label className="inline-flex items-center gap-2">
                          <span className="sr-only">
                            {mode} at {store.name}
                          </span>
                          <input
                            type="checkbox"
                            checked={store.services[mode]}
                            disabled={busy}
                            onChange={(event) =>
                              toggleService(store.id, mode, event.target.checked)
                            }
                            className="size-4 accent-red"
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'Promotions' && (
          <section>
            <h2 className="display text-2xl">Promotions</h2>
            <ul className="mt-4 space-y-3">
              {promotions.map((promotion) => (
                <li
                  key={promotion.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-white p-4"
                >
                  <div>
                    <p className="text-sm font-extrabold">{promotion.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{promotion.validity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="rounded-sm bg-red-10 px-2.5 py-1 text-xs font-extrabold text-red">
                      {promotion.code}
                    </code>
                    <span className="tabular text-sm font-bold">
                      {Math.round(promotion.discountRate * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">
              Campaigns are read-only until the promotions service is built. Creating and expiring
              them from here is repository work, not a console gap.
            </p>
          </section>
        )}

        {tab === 'Audit' && (
          <section>
            <h2 className="display text-2xl">Audit log</h2>
            <p className="mt-1 text-sm text-muted">
              Every change written through the console, newest first.
            </p>
            <ol className="mt-4 divide-y divide-line rounded-md border border-line bg-white">
              {audit.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex gap-4 px-4 py-3">
                  <span className="tabular shrink-0 text-xs text-muted">
                    {new Date(entry.at).toLocaleTimeString('en-ZA', { timeStyle: 'medium' })}
                  </span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-[0.08em] text-red">
                    {entry.who}
                  </span>
                  <span className="text-xs">{entry.what}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
