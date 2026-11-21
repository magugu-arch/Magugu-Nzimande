import {
  createDemoClock,
  defaultControls,
  type DemoControls,
  type ScenarioId,
} from '@scarlets/adapters';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

interface DemoState extends DemoControls {
  /** Wall-clock ms when the scenario was chosen. The demo clock runs from here. */
  startedAt: number;
  setScenario: (scenario: ScenarioId) => void;
  set: (patch: Partial<Omit<DemoControls, 'scenario'>>) => void;
  reset: () => void;
}

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      ...defaultControls,
      startedAt: Date.now(),
      setScenario: (scenario) => set({ scenario, startedAt: Date.now() }),
      set: (patch) => set(patch),
      reset: () => set({ ...defaultControls, startedAt: Date.now() }),
    }),
    {
      name: 'scarlets:demo',
      storage: persistStorage,
      // The clock restarts with the app: a scenario always opens at its own moment.
      partialize: ({ scenario, liveFeed, ticketing, rewards, network, latencyMs }) => ({
        scenario,
        liveFeed,
        ticketing,
        rewards,
        network,
        latencyMs,
      }),
    },
  ),
);

export function demoControls(): DemoControls {
  const { scenario, liveFeed, ticketing, rewards, network, latencyMs } = useDemo.getState();
  return { scenario, liveFeed, ticketing, rewards, network, latencyMs };
}

/** The demo clock: a fixed scenario moment plus real time elapsed since it was chosen. */
export function demoNow(): Date {
  const { scenario, startedAt } = useDemo.getState();
  return createDemoClock(scenario, startedAt).now();
}
