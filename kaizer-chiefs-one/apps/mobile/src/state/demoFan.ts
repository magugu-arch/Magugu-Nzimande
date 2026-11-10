import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FanPost } from '@kc-one/contracts';
import { plainStorage } from './storage';

/**
 * Demo-only store for Fan Moments a supporter "submits" in the demo build.
 * They stay on this phone: nothing is uploaded and nobody reviews them.
 */
interface DemoFanState {
  posts: (FanPost & { localUri: string })[];
  add: (p: FanPost & { localUri: string }) => void;
  markRemoved: (id: string) => void;
  clear: () => void;
}

export const useDemoFan = create<DemoFanState>()(
  persist(
    (set) => ({
      posts: [],
      add: (p) => set((s) => ({ posts: [p, ...s.posts] })),
      markRemoved: (id) =>
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, status: 'removed_by_user' as const } : p,
          ),
        })),
      clear: () => set({ posts: [] }),
    }),
    { name: 'kc1.demo-fan', storage: plainStorage },
  ),
);
