'use client';

import { useSyncExternalStore } from 'react';
import { clock } from '@core/time/clock';
import {
  deliverDue,
  idMaker,
  perform,
  type ActionArgs,
  type ActionName,
  type CampaignDraft,
  type EmergencyInput,
  type NewEvent,
  type ArticlePatch,
  type Result,
  type VendorPatch,
} from './actions';
import * as live from './live';
import { demoDay, seed, SEED_VERSION, type ConsoleData } from './seed';
import type { AdminEvent, ModerationItem, OperatorRole, Segment } from './types';

export { currentOperator, validateDraft, type CampaignDraft, type Result } from './actions';

/**
 * The console's state.
 *
 * Demo mode keeps it in this browser (localStorage) so a presenter can
 * compose as one operator and approve as another — in a second tab, too,
 * since tabs sync through the `storage` event.
 *
 * Live mode (NEXT_PUBLIC_CONSOLE_MODE=live) keeps it on the BFF: staff sign
 * in with NMU SSO, the BFF runs each action for the operator it signed in
 * and refuses what their role doesn't allow, and the console shows what the
 * server holds, refreshed every few seconds so operators see each other's
 * work.
 *
 * Either way the actions are the same functions (`./actions.ts`):
 * permission-checked, and audited (brief §24).
 */

export const isLive = live.liveConfig.enabled;

const KEY = 'nmu-one-console';
const newId = idMaker();

let data: ConsoleData | null = null;
const listeners = new Set<() => void>();
let announcement = { id: 0, text: '' };

export type LiveStatus = 'signed-out' | 'loading' | 'ready' | 'unavailable';
let liveStatus: LiveStatus = 'loading';

function load(): ConsoleData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ConsoleData;
      // Keep a demo for its day; a new demo day starts from fresh seed data.
      if (parsed.version === SEED_VERSION && parsed.day === demoDay(clock.now())) return parsed;
    }
  } catch {
    // Private windows and blocked storage fall back to a fresh demo.
  }
  return seed(clock.now());
}

function persist(next: ConsoleData) {
  if (isLive) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage is a convenience; the console works without it.
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (isLive || e.key !== KEY) return;
    data = load();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The console's data. In live mode, only read once `useLiveStatus()` is 'ready'. */
export function getData(): ConsoleData {
  if (!data) data = isLive ? seed(clock.now()) : load();
  return data;
}

export function useConsole(): ConsoleData {
  return useSyncExternalStore(subscribe, getData, getData);
}

export function useAnnouncement() {
  return useSyncExternalStore(
    subscribe,
    () => announcement,
    () => announcement,
  );
}

/** Polite status message for screen readers and the on-screen toast. */
export function announce(text: string) {
  announcement = { id: announcement.id + 1, text };
  emit();
}

function set(next: ConsoleData) {
  data = next;
  persist(next);
  emit();
}

/** Runs an action: here in demo mode, on the BFF in live mode. */
async function dispatch<K extends ActionName>(name: K, args: ActionArgs[K]): Promise<Result> {
  if (isLive) {
    try {
      const r = await live.postAction(name, args);
      if (r.ok) set(r.data);
      announce(r.message);
      return r.ok
        ? { ok: true, message: r.message, ...(r.id ? { id: r.id } : {}) }
        : { ok: false, message: r.message };
    } catch (e) {
      if (e instanceof live.SignedOut) setLiveStatus('signed-out');
      const message =
        e instanceof live.SignedOut
          ? 'Your session ended. Sign in again.'
          : 'The console service isn’t answering, so nothing changed.';
      announce(message);
      return { ok: false, message };
    }
  }
  const d = getData();
  const r = perform(d, d.operatorId, name, args, clock.now(), newId);
  if (!r.ok) {
    announce(r.message);
    return { ok: false, message: r.message };
  }
  set(r.data);
  announce(r.message);
  return { ok: true, message: r.message, ...(r.id ? { id: r.id } : {}) };
}

// ── Session ──────────────────────────────────────────────────────────────────

function setLiveStatus(next: LiveStatus) {
  liveStatus = next;
  emit();
}

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(
    subscribe,
    () => liveStatus,
    () => 'loading' as LiveStatus,
  );
}

/** Live mode: loads what the server holds for the signed-in operator. */
export async function refreshLive(): Promise<void> {
  if (!isLive) return;
  if (!live.readSession()) {
    setLiveStatus('signed-out');
    return;
  }
  try {
    data = await live.fetchState();
    setLiveStatus('ready');
  } catch (e) {
    setLiveStatus(e instanceof live.SignedOut ? 'signed-out' : 'unavailable');
  }
}

export const liveSession = () => (isLive ? live.readSession() : null);
export const startSignIn = () => live.startSignIn();
export const finishSignIn = (href: string) => live.finishSignIn(href);

export async function signOut() {
  await live.signOut();
  data = null;
  setLiveStatus('signed-out');
}

/** Demo only: in live mode, who you are comes from NMU SSO. */
export function switchOperator(id: string) {
  if (isLive) return;
  const d = getData();
  const op = d.operators.find((o) => o.id === id);
  if (!op) return;
  set({ ...d, operatorId: id });
  announce(`Now working as ${op.name}, ${op.title}.`);
}

export function resetDemo() {
  if (isLive) return;
  set(seed(clock.now()));
  announce('Demo data reset.');
}

/** Scheduled notices whose time has come are delivered (the BFF does this in live mode). */
export function runScheduler() {
  if (isLive) return;
  const next = deliverDue(getData(), clock.now());
  if (next) set(next);
}

// ── Notifications: create → approve → schedule → deliver → measure ───────────

export const saveCampaign = (draft: CampaignDraft, id: string | null, submit: boolean) =>
  dispatch('saveCampaign', { draft, id, submit });
export const approveCampaign = (id: string, note: string) =>
  dispatch('approveCampaign', { id, note });
export const requestChanges = (id: string, note: string) =>
  dispatch('requestChanges', { id, note });
export const deliverNow = (id: string) => dispatch('deliverNow', { id });
export const withdrawCampaign = (id: string) => dispatch('withdrawCampaign', { id });
export const sendEmergency = (input: EmergencyInput) => dispatch('sendEmergency', input);

// ── Audiences, events, commerce, content, moderation, roles ──────────────────

export const saveSegment = (input: Omit<Segment, 'id' | 'createdBy'>) =>
  dispatch('saveSegment', input);
export const createEvent = (input: NewEvent) => dispatch('createEvent', input);
export const setEventStatus = (id: string, status: AdminEvent['status']) =>
  dispatch('setEventStatus', { id, status });
export const setVendor = (id: string, patch: VendorPatch) => dispatch('setVendor', { id, patch });
export const setItemAvailable = (vendorId: string, itemId: string, available: boolean) =>
  dispatch('setItemAvailable', { vendorId, itemId, available });
export const updateArticle = (id: string, patch: ArticlePatch) =>
  dispatch('updateArticle', { id, patch });
export const approveArticle = (id: string) => dispatch('approveArticle', { id });
export const moderate = (id: string, status: ModerationItem['status']) =>
  dispatch('moderate', { id, status });
export const setOperatorRole = (id: string, role: OperatorRole) =>
  dispatch('setOperatorRole', { id, role });
