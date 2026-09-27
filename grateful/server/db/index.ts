import { config } from '../config';
import { createMemoryRepository } from './memory';
import { createSupabaseRepository } from './supabase';
import type { Repository } from './types';

let instance: Repository | null = null;

/**
 * The repository for this process. Supabase when credentials are set;
 * otherwise the in-memory store, which production refuses outright so a
 * missing environment variable can never silently lose real bookings.
 */
export function repository(): Repository {
  if (instance) return instance;
  const c = config();
  if (c.database === 'supabase') {
    instance = createSupabaseRepository(c.supabaseUrl!, c.supabaseServiceRoleKey!);
  } else {
    if (c.isProduction) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production.');
    instance = createMemoryRepository({ demoPricing: c.demoPricing });
  }
  return instance;
}

/** Tests only: swap in a fresh repository. */
export function setRepository(repo: Repository | null) {
  instance = repo;
}
