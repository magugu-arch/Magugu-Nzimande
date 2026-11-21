import { createGateway, type Gateway } from '@hao/api-gateway';
import { createLocalPlatform } from '@hao/local-platform';

let instance: Gateway | null = null;

/**
 * The one gateway for this browser tab. Mock data lives in localStorage on this
 * device and is never sent anywhere. Only call from the browser (effects, event
 * handlers and query functions) — never while rendering on the server.
 */
export function getGateway(): Gateway {
  if (typeof window === 'undefined') {
    throw new Error('getGateway() is browser-only. Call it inside a query or an effect.');
  }
  if (!instance) {
    instance = createGateway(createLocalPlatform({ storage: window.localStorage }));
  }
  return instance;
}

/** Wipes every piece of demo data on this device and reloads with fresh sample data. */
export function resetDemoData(): void {
  getGateway().platform.store.clear();
  window.sessionStorage.clear();
  window.location.reload();
}
