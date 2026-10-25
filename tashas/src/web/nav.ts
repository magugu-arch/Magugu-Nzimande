/**
 * Navigation: one stack per tab (so each tab keeps its place), plus a stack of
 * sheets above everything. Pages push from the right and pop back the same
 * way; sheets rise from the bottom on phones and the right on desktop.
 */

import { useEffect, useState } from 'preact/hooks';
import type { ServicePeriodId, Utm } from '../domain/types.ts';

export type Tab = 'today' | 'cafes' | 'menu' | 'rewards' | 'profile' | 'ops';

export type Route =
  | { name: 'root' }
  | { name: 'cafe'; id: string }
  | { name: 'campaign'; slug: string; utm?: Utm; campaignId?: string }
  | { name: 'event'; id: string }
  | { name: 'booking'; id: string }
  | { name: 'attempt'; id: string }
  | { name: 'bookings' }
  | { name: 'inbox' }
  | { name: 'preferences' }
  | { name: 'help' }
  | { name: 'privacy' }
  | { name: 'about' }
  | { name: 'assets' }
  | { name: 'favourites' }
  | { name: 'details' };

export interface BookPreset {
  branchId?: string;
  date?: string;
  period?: ServicePeriodId;
  weekday?: number;
  partySize?: number;
  source?: string;
}

export type Sheet =
  | { name: 'book'; preset: BookPreset }
  | { name: 'reschedule'; bookingId: string }
  | { name: 'menu-item'; id: string }
  | { name: 'checkout'; paymentId: string; returnTo: { kind: 'attempt' | 'event'; id: string } }
  | { name: 'cancel-booking'; id: string }
  | { name: 'event-reserve'; id: string }
  | { name: 'share' };

interface NavState {
  tab: Tab;
  stacks: Record<Tab, Route[]>;
  sheets: { key: number; sheet: Sheet; closing: boolean }[];
  /** Direction of the last stack change, for the transition. */
  last: { tab: Tab; kind: 'push' | 'pop' | 'none' };
}

const root = (): Route[] => [{ name: 'root' }];

let state: NavState = {
  tab: 'today',
  stacks: { today: root(), cafes: root(), menu: root(), rewards: root(), profile: root(), ops: root() },
  sheets: [],
  last: { tab: 'today', kind: 'none' },
};

const listeners = new Set<() => void>();
let sheetKey = 1;

function set(next: NavState): void {
  state = next;
  for (const l of listeners) l();
}

export function navState(): NavState {
  return state;
}

export function useNav(): NavState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export function switchTab(tab: Tab, extra?: { menuCategory?: string; query?: string }): void {
  if (extra) pendingIntent = { ...pendingIntent, ...extra };
  if (state.tab === tab) {
    // Tapping the current tab returns to its root, as on iOS.
    if (state.stacks[tab].length > 1) set({ ...state, stacks: { ...state.stacks, [tab]: root() }, last: { tab, kind: 'pop' } });
    else set({ ...state });
    return;
  }
  set({ ...state, tab, last: { tab, kind: 'none' } });
}

export function push(route: Route, tab: Tab = state.tab): void {
  const stacks = { ...state.stacks, [tab]: [...state.stacks[tab], route] };
  set({ ...state, tab, stacks, last: { tab, kind: 'push' } });
}

export function pop(tab: Tab = state.tab): void {
  const stack = state.stacks[tab];
  if (stack.length <= 1) return;
  set({ ...state, stacks: { ...state.stacks, [tab]: stack.slice(0, -1) }, last: { tab, kind: 'pop' } });
}

export function openSheet(sheet: Sheet): void {
  set({ ...state, sheets: [...state.sheets, { key: sheetKey++, sheet, closing: false }] });
}

/** Marks the top sheet as closing; the sheet removes itself when its spring settles. */
export function closeSheet(key?: number): void {
  const target = key ?? state.sheets[state.sheets.length - 1]?.key;
  if (target === undefined) return;
  set({ ...state, sheets: state.sheets.map((s) => (s.key === target ? { ...s, closing: true } : s)) });
}

export function removeSheet(key: number): void {
  set({ ...state, sheets: state.sheets.filter((s) => s.key !== key) });
}

export function replaceSheet(key: number, sheet: Sheet): void {
  set({ ...state, sheets: state.sheets.map((s) => (s.key === key ? { ...s, sheet } : s)) });
}

/** One-shot hints passed to a tab's root screen (a search query, a category). */
let pendingIntent: { menuCategory?: string; query?: string } = {};
export function takeIntent<K extends keyof typeof pendingIntent>(key: K): (typeof pendingIntent)[K] {
  const v = pendingIntent[key];
  delete pendingIntent[key];
  return v;
}

export function openBook(preset: BookPreset = {}): void {
  openSheet({ name: 'book', preset });
}
