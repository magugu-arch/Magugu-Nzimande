import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';

// The static preview's in-browser API and banner load only in that build.
// Checked inline (not via lib/env) so the bundler can drop the demo chunks from production.
const DemoApp = import.meta.env.VITE_DEMO === 'true' ? lazy(() => import('./DemoApp')) : null;
const browserRouter = DemoApp ? null : createBrowserRouter(routes);

export function App() {
  if (DemoApp) {
    return (
      <Suspense fallback={null}>
        <DemoApp />
      </Suspense>
    );
  }
  return <RouterProvider router={browserRouter!} />;
}
