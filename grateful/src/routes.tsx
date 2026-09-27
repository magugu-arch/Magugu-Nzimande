import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { Layout } from './components/layout/Layout';
import Home from './pages/Home';
import RouteError from './pages/RouteError';

// Home ships in the main bundle; everything else loads when first visited.
const Work = lazy(() => import('./pages/Work'));
const WorkDetail = lazy(() => import('./pages/WorkDetail'));
const About = lazy(() => import('./pages/About'));
const Services = lazy(() => import('./pages/Services'));
const Booking = lazy(() => import('./pages/Booking'));
const Payment = lazy(() => import('./pages/Payment'));
const MockCheckout = lazy(() => import('./pages/MockCheckout'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Contact = lazy(() => import('./pages/Contact'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const Privacy = lazy(() => import('./pages/Privacy'));

const page = (el: ReactNode) => <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>{el}</Suspense>;

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/work', element: page(<Work />) },
      { path: '/work/:slug', element: page(<WorkDetail />) },
      { path: '/about', element: page(<About />) },
      { path: '/services', element: page(<Services />) },
      { path: '/booking', element: page(<Booking />) },
      { path: '/payment', element: page(<Payment />) },
      { path: '/payment/mock', element: page(<MockCheckout />) },
      { path: '/confirmation', element: page(<Confirmation />) },
      { path: '/contact', element: page(<Contact />) },
      { path: '/unsubscribe', element: page(<Unsubscribe />) },
      { path: '/privacy', element: page(<Privacy />) },
      { path: '*', element: page(<NotFound />) },
    ],
  },
];

