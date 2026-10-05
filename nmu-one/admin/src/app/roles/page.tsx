import type { Metadata } from 'next';
import { Roles } from '@/views/Roles';

export const metadata: Metadata = { title: 'Roles & permissions' };

export default function Page() {
  return <Roles />;
}
