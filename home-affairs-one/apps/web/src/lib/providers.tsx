'use client';

import { LIVE_REGION_ID } from '@hao/accessibility';
import { DesignSystemProvider, type LinkProps } from '@hao/design-system';
import { TOPICS } from '@hao/local-platform';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { withBasePath } from './base-path';
import { getGateway } from './gateway';
import { SessionProvider } from './session';

/** Routes design-system links through Next so navigation stays client-side and base-path aware. */
function RouterLink({ href, children, ...rest }: LinkProps) {
  const external = /^(https?:|mailto:|tel:)/.test(href);
  if (external) {
    return (
      <a href={href} rel="noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

/** Refreshes every query shortly after anything in the mock store changes. */
function StoreBridge({ client }: { client: QueryClient }) {
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = getGateway().platform.bus.subscribe(TOPICS.storeChanged, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void client.invalidateQueries(), 60);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [client]);
  return null;
}

/** Registers the offline shell in production builds only, so development never serves stale files. */
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    // The single-file build has nothing to cache and no address to register against.
    if (process.env.NEXT_PUBLIC_SINGLE_FILE) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;
    navigator.serviceWorker.register(withBasePath('/sw.js')).catch(() => undefined);
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The gateway already retries with back-off; do not stack another layer.
            retry: false,
            staleTime: 5_000,
            refetchOnWindowFocus: false,
            // There is no real network: the gateway decides what "offline" means.
            networkMode: 'always',
          },
          mutations: { retry: false, networkMode: 'always' },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <DesignSystemProvider linkComponent={RouterLink}>
        <SessionProvider>
          <StoreBridge client={client} />
          <ServiceWorkerRegistrar />
          {children}
          <div id={LIVE_REGION_ID} role="status" aria-live="polite" className="visually-hidden" />
        </SessionProvider>
      </DesignSystemProvider>
    </QueryClientProvider>
  );
}
