import { createMockAdapters } from '@scarlets/adapters';
import { createService, type RequestContext, type ScarletsApi } from '@scarlets/api-client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocale } from '@/i18n';
import { demoControls, demoNow } from '@/state/demo';
import { useAccount } from '@/state/session';
import { keyValueStore } from '@/state/storage';

/**
 * DEMO DATA LAYER.
 *
 * This build runs the API service in-process over the mock provider adapters,
 * so the whole app works with no backend. To point it at a real server, swap
 * the line below for:
 *
 *   createHttpApi({ baseUrl, deviceId, getAccessToken })
 *
 * Screens only ever see the ScarletsApi interface, so nothing else changes.
 */
const api: ScarletsApi = createService({
  adapters: createMockAdapters({ controls: demoControls, clock: demoNow, store: keyValueStore }),
  clock: demoNow,
});

const ApiContext = createContext<ScarletsApi>(api);

export function ApiProvider({ children, value }: { children: ReactNode; value?: ScarletsApi }) {
  return <ApiContext.Provider value={value ?? api}>{children}</ApiContext.Provider>;
}

export function useApi(): ScarletsApi {
  return useContext(ApiContext);
}

export function useRequestContext(): RequestContext {
  const locale = useLocale();
  const account = useAccount();
  return useMemo(
    () => ({ locale, account }),
    // The account object is rebuilt each render; its fields are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, account.state, account.userId, account.deviceId, account.member],
  );
}
