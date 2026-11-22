import { createMemoryStorage, type StorageLike } from '@hao/local-platform';

const fallback: Partial<Record<'local' | 'session', StorageLike>> = {};

/**
 * Browser storage that never throws. Storage can be blocked — private browsing,
 * a sandboxed frame, a file opened from a chat app — and the prototype must
 * still work, keeping its sample data in memory for that visit instead.
 */
export function safeStorage(kind: 'local' | 'session'): StorageLike {
  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__hao_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return (fallback[kind] ??= createMemoryStorage());
  }
}
