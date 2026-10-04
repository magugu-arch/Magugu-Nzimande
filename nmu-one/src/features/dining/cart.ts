import { create } from 'zustand';
import type { MenuItem, Money } from '@/core/domain/models';
import { addMoney, multiplyMoney } from '@/core/domain/money';

/**
 * A campus order is collected from one counter, so a cart holds one vendor.
 * Adding from a second vendor starts a new cart — the screen asks first.
 */
export interface CartLine {
  item: MenuItem;
  quantity: number;
}

export interface Cart {
  vendorId: string | null;
  lines: CartLine[];
}

export const MAX_PER_ITEM = 10;

export const emptyCart = (): Cart => ({ vendorId: null, lines: [] });

export function addItem(cart: Cart, item: MenuItem): Cart {
  if (!item.available) return cart;
  const base = cart.vendorId && cart.vendorId !== item.vendorId ? emptyCart() : cart;
  const existing = base.lines.find((l) => l.item.id === item.id);
  const lines = existing
    ? base.lines.map((l) => (l.item.id === item.id ? { ...l, quantity: Math.min(MAX_PER_ITEM, l.quantity + 1) } : l))
    : [...base.lines, { item, quantity: 1 }];
  return { vendorId: item.vendorId, lines };
}

export function removeItem(cart: Cart, itemId: string): Cart {
  const lines = cart.lines
    .map((l) => (l.item.id === itemId ? { ...l, quantity: l.quantity - 1 } : l))
    .filter((l) => l.quantity > 0);
  return lines.length ? { ...cart, lines } : emptyCart();
}

export const cartTotal = (cart: Cart): Money =>
  addMoney(...cart.lines.map((l) => multiplyMoney(l.item.price, l.quantity)));

export const cartCount = (cart: Cart): number => cart.lines.reduce((n, l) => n + l.quantity, 0);

export const quantityOf = (cart: Cart, itemId: string): number =>
  cart.lines.find((l) => l.item.id === itemId)?.quantity ?? 0;

interface CartState {
  cart: Cart;
  add(item: MenuItem): void;
  remove(itemId: string): void;
  clear(): void;
}

export const useCart = create<CartState>((set) => ({
  cart: emptyCart(),
  add: (item) => set((s) => ({ cart: addItem(s.cart, item) })),
  remove: (itemId) => set((s) => ({ cart: removeItem(s.cart, itemId) })),
  clear: () => set({ cart: emptyCart() }),
}));
