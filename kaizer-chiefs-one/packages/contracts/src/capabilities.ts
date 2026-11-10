/**
 * Capability flags. Every integration-backed feature sits behind one, so a
 * feature only goes live once its provider and its legal and operational
 * requirements are approved.
 *
 *   off   the feature says it is not available
 *   demo  a demo adapter serves visibly labelled sample content
 *   live  the feature calls the backend's provider adapter
 */
export const FEATURES = [
  'content',
  'matchData',
  'membership',
  'tickets',
  'fanMoments',
  'commerce',
  'rewards',
  'notifications',
  'payments',
] as const;
export type Feature = (typeof FEATURES)[number];

export const CAPABILITY_MODES = ['off', 'demo', 'live'] as const;
export type CapabilityMode = (typeof CAPABILITY_MODES)[number];

export const APP_ENVIRONMENTS = ['local', 'staging', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export type Capabilities = Record<Feature, CapabilityMode>;

export const FEATURE_COPY: Record<Feature, string> = {
  content: 'Club content (CMS)',
  matchData: 'Fixtures, Match Centre and squad',
  membership: 'Digital Membership',
  tickets: 'Ticket Wallet',
  fanMoments: 'Fan Moments',
  commerce: 'Shop',
  rewards: 'Khosi Rewards',
  notifications: 'Push notifications',
  payments: 'In-app payments',
};

/** Variable names (never values) a live feature needs in the app build. */
export const LIVE_REQUIREMENTS: Record<Feature, readonly string[]> = {
  content: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  matchData: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  membership: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  tickets: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  fanMoments: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  commerce: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SHOP_URL'],
  rewards: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
  notifications: [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_EAS_PROJECT_ID',
  ],
  payments: [],
};

export interface CapabilityInput {
  appEnv: AppEnvironment;
  /** Explicit per-feature modes, e.g. parsed from EXPO_PUBLIC_FEATURE_MATCH_DATA. */
  flags: Partial<Record<Feature, string | undefined>>;
  /** Environment variables available to the build (values are only checked for presence). */
  vars: Record<string, string | undefined>;
}

export interface CapabilityResolution {
  capabilities: Capabilities;
  /** Human-readable configuration problems. Any problem is fatal at startup. */
  problems: string[];
}

function defaultMode(env: AppEnvironment, feature: Feature): CapabilityMode {
  if (feature === 'payments') return 'off';
  return env === 'local' ? 'demo' : 'off';
}

export function resolveCapabilities(input: CapabilityInput): CapabilityResolution {
  const problems: string[] = [];
  const capabilities = {} as Capabilities;

  for (const feature of FEATURES) {
    const raw = input.flags[feature]?.trim().toLowerCase();
    let mode: CapabilityMode;
    if (!raw) mode = defaultMode(input.appEnv, feature);
    else if ((CAPABILITY_MODES as readonly string[]).includes(raw)) mode = raw as CapabilityMode;
    else {
      problems.push(`${feature}: "${raw}" is not one of off, demo, live.`);
      mode = 'off';
    }

    if (mode === 'demo' && input.appEnv === 'production') {
      problems.push(`${feature}: demo adapters are blocked in production builds.`);
      mode = 'off';
    }

    if (feature === 'payments' && mode !== 'off') {
      problems.push('payments: in-app payment capture is not approved. Keep it off.');
      mode = 'off';
    }

    if (mode === 'live') {
      const missing = LIVE_REQUIREMENTS[feature].filter((name) => !input.vars[name]?.trim());
      if (missing.length > 0) {
        problems.push(`${feature}: live mode needs ${missing.join(', ')}.`);
        mode = 'off';
      }
    }

    capabilities[feature] = mode;
  }

  return { capabilities, problems };
}

/** True if any feature is serving demo content. Drives the DEMO build marker. */
export function anyDemo(c: Capabilities): boolean {
  return FEATURES.some((f) => c[f] === 'demo');
}

export class ConfigurationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid app configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigurationError';
  }
}

export function assertCapabilities(input: CapabilityInput): Capabilities {
  const { capabilities, problems } = resolveCapabilities(input);
  if (problems.length > 0) throw new ConfigurationError(problems);
  return capabilities;
}
