'use client';

import {
  DEFAULT_PREFS,
  applyPrefs,
  loadPrefs,
  savePrefs,
  type AccessibilityPrefs,
} from '@hao/accessibility';
import { FLAG_PROFILES, type FeatureFlag, type FeatureFlags } from '@hao/shared-types';
import { useCallback, useSyncExternalStore } from 'react';
import { safeStorage } from './storage';

const FLAGS_KEY = 'hao.flags.v1';
const PROFILE = process.env.NEXT_PUBLIC_FLAG_PROFILE === 'pilot' ? 'pilot' : 'prototype';
export const DEFAULT_FLAGS: FeatureFlags = FLAG_PROFILES[PROFILE];
export const FLAG_PROFILE_NAME = PROFILE;

interface Settings {
  prefs: AccessibilityPrefs;
  flags: FeatureFlags;
}

/* Preferences and flags live in this device's localStorage. A tiny external
   store keeps React in step with them; the server snapshot is the defaults, so
   static HTML and the first client render always agree. */
const SERVER_SETTINGS: Settings = { prefs: DEFAULT_PREFS, flags: DEFAULT_FLAGS };
let settings: Settings | null = null;
const listeners = new Set<() => void>();

function loadFlags(): FeatureFlags {
  try {
    const raw = safeStorage('local').getItem(FLAGS_KEY);
    return raw
      ? { ...DEFAULT_FLAGS, ...(JSON.parse(raw) as Partial<FeatureFlags>) }
      : DEFAULT_FLAGS;
  } catch {
    return DEFAULT_FLAGS;
  }
}

function getSnapshot(): Settings {
  settings ??= { prefs: loadPrefs(safeStorage('local')), flags: loadFlags() };
  return settings;
}

function update(next: Settings) {
  settings = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SETTINGS);
}

/** Accessibility and data preferences. Changes apply at once and are remembered on this device. */
export function usePrefs() {
  const { prefs } = useSettings();
  const setPrefs = useCallback((patch: Partial<AccessibilityPrefs>) => {
    const currentSettings = getSnapshot();
    const next = { ...currentSettings.prefs, ...patch };
    savePrefs(safeStorage('local'), next);
    applyPrefs(document.documentElement, next);
    update({ ...currentSettings, prefs: next });
  }, []);
  return { prefs, setPrefs };
}

/** Feature flags for the gated capabilities (wallet, biometrics, service guide, partners). */
export function useFlags() {
  const { flags } = useSettings();
  const setFlag = useCallback((flag: FeatureFlag, enabled: boolean) => {
    const currentSettings = getSnapshot();
    const next = { ...currentSettings.flags, [flag]: enabled };
    safeStorage('local').setItem(FLAGS_KEY, JSON.stringify(next));
    update({ ...currentSettings, flags: next });
  }, []);
  const resetFlags = useCallback(() => {
    safeStorage('local').removeItem(FLAGS_KEY);
    update({ ...getSnapshot(), flags: DEFAULT_FLAGS });
  }, []);
  return { flags, setFlag, resetFlags };
}
