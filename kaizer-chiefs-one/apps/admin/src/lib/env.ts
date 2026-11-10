import 'server-only';
import {
  APP_ENVIRONMENTS,
  ConfigurationError,
  resolveCapabilities,
  type AppEnvironment,
  type Capabilities,
} from '@kc-one/contracts';

/** Used only for local development; refused in staging and production. */
const LOCAL_ONLY_SECRET = 'local-development-only-this-is-not-a-secret-0000';

export interface AdminConfig {
  appEnv: AppEnvironment;
  sessionSecret: string;
  /** Demo sign-in (role picker) is a local/staging convenience only. */
  demoSignIn: boolean;
  capabilities: Capabilities;
}

/**
 * Reads and validates the admin's server configuration. Fails clearly, by
 * variable name, when anything required for the environment is missing.
 */
export function readAdminConfig(
  env: Record<string, string | undefined> = process.env,
): AdminConfig {
  const raw = (env.ADMIN_APP_ENV ?? 'local').trim().toLowerCase();
  const appEnv = (
    (APP_ENVIRONMENTS as readonly string[]).includes(raw) ? raw : 'local'
  ) as AppEnvironment;
  const problems: string[] = [];

  const secret = env.ADMIN_SESSION_SECRET?.trim();
  if (appEnv !== 'local' && (!secret || secret.length < 32)) {
    problems.push('ADMIN_SESSION_SECRET must be set to at least 32 random characters.');
  }
  if (appEnv === 'production') {
    for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
      if (!env[name]?.trim()) problems.push(`${name} is required in production.`);
    }
  }

  const { capabilities, problems: capProblems } = resolveCapabilities({
    appEnv,
    flags: {
      content: env.ADMIN_FEATURE_CONTENT,
      matchData: env.ADMIN_FEATURE_MATCH_DATA,
      membership: env.ADMIN_FEATURE_MEMBERSHIP,
      tickets: env.ADMIN_FEATURE_TICKETS,
      fanMoments: env.ADMIN_FEATURE_FAN_MOMENTS,
      commerce: env.ADMIN_FEATURE_COMMERCE,
      rewards: env.ADMIN_FEATURE_REWARDS,
      notifications: env.ADMIN_FEATURE_NOTIFICATIONS,
      payments: env.ADMIN_FEATURE_PAYMENTS,
    },
    vars: {
      EXPO_PUBLIC_SUPABASE_URL: env.SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      EXPO_PUBLIC_SHOP_URL: env.SHOP_URL,
      EXPO_PUBLIC_EAS_PROJECT_ID: env.EAS_PROJECT_ID,
    },
  });
  problems.push(...capProblems);

  if (problems.length > 0) throw new ConfigurationError(problems);
  return {
    appEnv,
    sessionSecret: secret || LOCAL_ONLY_SECRET,
    demoSignIn: appEnv !== 'production',
    capabilities,
  };
}
