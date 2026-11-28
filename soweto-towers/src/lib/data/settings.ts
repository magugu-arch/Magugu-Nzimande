import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { liveActivities, type LiveActivity } from '@/lib/booking/engine';
import { SETTINGS_DEFAULTS, type SettingsShape } from './settings-types';

export async function getSetting<K extends keyof SettingsShape>(key: K): Promise<SettingsShape[K]> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  const value = rows[0]?.value as SettingsShape[K] | undefined;
  if (value === undefined) return SETTINGS_DEFAULTS[key];
  if (typeof value === 'object' && value && !Array.isArray(value)) {
    return { ...(SETTINGS_DEFAULTS[key] as object), ...(value as object) } as SettingsShape[K];
  }
  return value;
}

export async function setSetting<K extends keyof SettingsShape>(key: K, value: SettingsShape[K]): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

/** Prices as published, with staff overrides. Cached in the static shell; staff edits expire the tag. */
export async function getLiveCatalog(): Promise<LiveActivity[]> {
  'use cache';
  cacheTag('catalog');
  cacheLife('hours');
  return liveActivities(await getSetting('price_overrides'));
}
