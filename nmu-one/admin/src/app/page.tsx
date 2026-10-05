import type { Metadata } from 'next';
import { Dashboard } from '@/views/Dashboard';

// The root page shares the layout's segment, so the title template doesn't apply.
export const metadata: Metadata = { title: { absolute: 'Dashboard · NMU ONE Console' } };

export default function Page() {
  return <Dashboard />;
}
