'use client';

import { useSyncExternalStore } from 'react';
import type { CartLine } from '@/lib/shop';

/**
 * The cart lives in the visitor's browser (localStorage), so it survives
 * reloads and follows them across tabs. It holds slugs and quantities only;
 * prices and titles always come from the catalog the server renders, and the
 * checkout action recomputes everything. If storage is blocked (a private
 * window, a strict browser) the cart still works for the current page view.
 */

const KEY = 'mg-cart-v1';
const EMPTY: CartLine[] = [];

let memory: CartLine[] = EMPTY;
/** Counts additions in this page view, so the header can react to an add (not to a page load). */
let pulse = 0;
let cachedRaw: string | null | undefined;
let cachedLines: CartLine[] = EMPTY;
const listeners = new Set<() => void>();

function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    return data.filter(
      (l): l is CartLine =>
        !!l && typeof l.slug === 'string' && typeof l.qty === 'number' && l.qty > 0,
    );
  } catch {
    return EMPTY;
  }
}

function snapshot(): CartLine[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return memory;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parse(raw);
  }
  return cachedLines;
}

function write(lines: CartLine[]) {
  memory = lines;
  try {
    if (lines.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked: the in-memory copy carries this page view.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useCartPulse(): number {
  return useSyncExternalStore(
    subscribe,
    () => pulse,
    () => 0,
  );
}

/** Raw cart lines; render through normaliseCart() with the catalog. Empty on the server. */
export function useCartLines(): CartLine[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export const cart = {
  /** Adds copies up to `max`; returns the book's quantity before and after. */
  add(slug: string, max: number, qty = 1): { before: number; after: number } {
    const lines = snapshot();
    const existing = lines.find((l) => l.slug === slug);
    const before = existing?.qty ?? 0;
    const after = Math.min(before + qty, max);
    if (after !== before) {
      pulse += 1;
      write(
        existing
          ? lines.map((l) => (l.slug === slug ? { slug, qty: after } : l))
          : [...lines, { slug, qty: after }],
      );
    }
    return { before, after };
  },
  set(slug: string, qty: number, max: number) {
    const next = Math.max(1, Math.min(Math.floor(qty) || 1, max));
    write(snapshot().map((l) => (l.slug === slug ? { slug, qty: next } : l)));
  },
  remove(slug: string) {
    write(snapshot().filter((l) => l.slug !== slug));
  },
  /** Empties the cart and returns what was in it, for undo. */
  clear(): CartLine[] {
    const previous = snapshot();
    write(EMPTY);
    return previous;
  },
  restore(lines: CartLine[]) {
    write(lines);
  },
};
