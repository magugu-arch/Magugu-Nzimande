import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

type RestockRequest = { productId: string; size: string };

type SavedState = {
  productIds: string[];
  /** Kept on the device in demo mode; nothing is sent. */
  restock: RestockRequest[];
  toggle: (productId: string) => boolean;
  requestRestock: (request: RestockRequest) => void;
  removeRestock: (request: RestockRequest) => void;
};

export const useSaved = create<SavedState>()(
  persist(
    (set, get) => ({
      productIds: [],
      restock: [],
      toggle: (productId) => {
        const saved = get().productIds.includes(productId);
        set((s) => ({
          productIds: saved
            ? s.productIds.filter((id) => id !== productId)
            : [productId, ...s.productIds],
        }));
        return !saved;
      },
      requestRestock: (r) =>
        set((s) =>
          s.restock.some((x) => x.productId === r.productId && x.size === r.size)
            ? s
            : { restock: [...s.restock, r] },
        ),
      removeRestock: (r) =>
        set((s) => ({
          restock: s.restock.filter((x) => !(x.productId === r.productId && x.size === r.size)),
        })),
    }),
    { name: 'mx.saved', storage: persistStorage },
  ),
);
