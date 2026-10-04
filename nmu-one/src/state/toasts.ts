import { create } from 'zustand';

/**
 * In-app banners: a notification that lands while the app is open (an order
 * ready for pickup, a mentoring request) and short confirmations. One shows
 * at a time; the next waits its turn.
 */
export interface Toast {
  id: string;
  title: string;
  body?: string;
  href?: string;
  actionLabel?: string;
  tone: 'info' | 'success' | 'urgent';
}

interface ToastState {
  queue: Toast[];
  show(t: Omit<Toast, 'id'> & { id?: string }): void;
  dismiss(id: string): void;
}

let seq = 0;

export const useToasts = create<ToastState>((set) => ({
  queue: [],
  show: (t) =>
    set((s) => {
      const id = t.id ?? `toast-${++seq}`;
      if (s.queue.some((x) => x.id === id)) return s;
      return { queue: [...s.queue, { ...t, id }] };
    }),
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
}));

export const showToast = (t: Omit<Toast, 'id'> & { id?: string }) => useToasts.getState().show(t);
