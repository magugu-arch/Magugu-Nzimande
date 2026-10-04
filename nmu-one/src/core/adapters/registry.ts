import { config } from '../config';
import type { Providers } from './contracts';
import { createLiveProviders } from './live';
import { mockAcademic, mockFinance, mockLearning } from './mock/academic';
import { mockCampus, mockCommerce, mockLibrary, mockResidence, mockTransport } from './mock/campus';
import { mockAlumni, mockCommunity, mockNotifications, mockSupport } from './mock/community';
import { mockAuth, mockGuardian } from './mock/identity';

/**
 * The single switch between synthetic and live integrations (brief §30
 * "demo data is clearly separated from live integration contracts").
 * Features import `providers` and never know which set they are talking to.
 */
export function createMockProviders(): Providers {
  return {
    auth: mockAuth,
    academic: mockAcademic,
    learning: mockLearning,
    finance: mockFinance,
    library: mockLibrary,
    transport: mockTransport,
    residence: mockResidence,
    campus: mockCampus,
    commerce: mockCommerce,
    community: mockCommunity,
    notifications: mockNotifications,
    support: mockSupport,
    guardian: mockGuardian,
    alumni: mockAlumni,
  };
}

let active: Providers = config.dataMode === 'live' ? createLiveProviders() : createMockProviders();

/** Every feature reaches every integration through this object. */
export const providers: Providers = new Proxy({} as Providers, {
  get: (_target, key: keyof Providers) => active[key],
});

export const isDemoData = () => config.dataMode === 'mock';

export function setProvidersForTesting(next: Providers | null): void {
  active = next ?? (config.dataMode === 'live' ? createLiveProviders() : createMockProviders());
}
