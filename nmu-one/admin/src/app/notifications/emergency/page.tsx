import type { Metadata } from 'next';
import { Emergency } from '@/views/Emergency';

export const metadata: Metadata = { title: 'Emergency notice' };

export default function Page() {
  return <Emergency />;
}
