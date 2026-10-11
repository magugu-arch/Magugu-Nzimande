import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine } from '@/domain/types';
import { persistStorage } from './storage';

export const MAX_QUANTITY = 5;

type BagState = {
  lines: CartLine[];
  /** Adds one, or one more of an identical line. */
  add: (line: Omit<CartLine, 'quantity'>) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  /** Removes a line and returns it with its position, for Undo. */
  remove: (variantId: string) => { line: CartLine; index: number } | null;
  restore: (line: CartLine, index: number) => void;
  clear: () => void;
};

export const useBag = create<BagState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line) =>
        set((s) => {
          const existing = s.lines.find((l) => l.variantId === line.variantId);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l === existing ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + 1) } : l,
              ),
            };
          }
          return { lines: [...s.lines, { ...line, quantity: 1 }] };
        }),
      setQuantity: (variantId, quantity) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.variantId === variantId
              ? { ...l, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) }
              : l,
          ),
        })),
      remove: (variantId) => {
        const index = get().lines.findIndex((l) => l.variantId === variantId);
        if (index === -1) return null;
        const line = get().lines[index]!;
        set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) }));
        return { line, index };
      },
      restore: (line, index) =>
        set((s) => {
          const lines = s.lines.filter((l) => l.variantId !== line.variantId);
          lines.splice(Math.min(index, lines.length), 0, line);
          return { lines };
        }),
      clear: () => set({ lines: [] }),
    }),
    { name: 'mx.bag', storage: persistStorage },
  ),
);

export function bagCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}
