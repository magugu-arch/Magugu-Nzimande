import Constants from 'expo-constants';
import {
  APP_ENVIRONMENTS,
  resolveCapabilities,
  type AppEnvironment,
  type CapabilityResolution,
} from '@kc-one/contracts';

/**
 * Build configuration. Expo inlines EXPO_PUBLIC_* variables at build time, and
 * only when each is read by its literal name, so every one is spelled out.
 * Nothing secret belongs here: EXPO_PUBLIC_* values ship inside the app.
 */
const raw = {
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  SHOP_URL: process.env.EXPO_PUBLIC_SHOP_URL,
  EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  FEATURE_CONTENT: process.env.EXPO_PUBLIC_FEATURE_CONTENT,
  FEATURE_MATCH_DATA: process.env.EXPO_PUBLIC_FEATURE_MATCH_DATA,
  FEATURE_MEMBERSHIP: process.env.EXPO_PUBLIC_FEATURE_MEMBERSHIP,
  FEATURE_TICKETS: process.env.EXPO_PUBLIC_FEATURE_TICKETS,
  FEATURE_FAN_MOMENTS: process.env.EXPO_PUBLIC_FEATURE_FAN_MOMENTS,
  FEATURE_COMMERCE: process.env.EXPO_PUBLIC_FEATURE_COMMERCE,
  FEATURE_REWARDS: process.env.EXPO_PUBLIC_FEATURE_REWARDS,
  FEATURE_NOTIFICATIONS: process.env.EXPO_PUBLIC_FEATURE_NOTIFICATIONS,
  FEATURE_PAYMENTS: process.env.EXPO_PUBLIC_FEATURE_PAYMENTS,
};

function parseEnv(value: string | undefined): AppEnvironment {
  const v = (value ?? 'local').trim().toLowerCase();
  return (APP_ENVIRONMENTS as readonly string[]).includes(v) ? (v as AppEnvironment) : 'local';
}

export const appEnv: AppEnvironment = parseEnv(raw.APP_ENV);

export const resolution: CapabilityResolution = resolveCapabilities({
  appEnv,
  flags: {
    content: raw.FEATURE_CONTENT,
    matchData: raw.FEATURE_MATCH_DATA,
    membership: raw.FEATURE_MEMBERSHIP,
    tickets: raw.FEATURE_TICKETS,
    fanMoments: raw.FEATURE_FAN_MOMENTS,
    commerce: raw.FEATURE_COMMERCE,
    rewards: raw.FEATURE_REWARDS,
    notifications: raw.FEATURE_NOTIFICATIONS,
    payments: raw.FEATURE_PAYMENTS,
  },
  vars: {
    EXPO_PUBLIC_SUPABASE_URL: raw.SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: raw.SUPABASE_ANON_KEY,
    EXPO_PUBLIC_SHOP_URL: raw.SHOP_URL,
    EXPO_PUBLIC_EAS_PROJECT_ID: raw.EAS_PROJECT_ID,
  },
});

export const capabilities = resolution.capabilities;

export const backend = {
  supabaseUrl: raw.SUPABASE_URL?.replace(/\/$/, '') ?? null,
  anonKey: raw.SUPABASE_ANON_KEY ?? null,
  shopUrl: raw.SHOP_URL ?? null,
};

export const appVersion = Constants.expoConfig?.version ?? '0.0.0';
