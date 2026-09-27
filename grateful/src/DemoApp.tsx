import { useMemo, useSyncExternalStore } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DemoBanner } from './components/DemoBanner';
import { demo } from './lib/demoApi';
import { resetServicesCache } from './lib/useServices';
import { routes } from './routes';

/**
 * DEMO BUILD ONLY. The static preview has no server to answer deep links, so
 * it routes in memory. Flipping sample prices restarts the app on Services
 * so every page re-reads the catalogue.
 */
export default function DemoApp() {
  const pricing = useSyncExternalStore(demo.subscribe, () => demo.samplePricing);
  const router = useMemo(() => {
    resetServicesCache();
    return createMemoryRouter(routes, { initialEntries: [pricing ? '/services' : '/'] });
  }, [pricing]);
  return (
    <>
      <RouterProvider router={router} />
      <DemoBanner />
    </>
  );
}
