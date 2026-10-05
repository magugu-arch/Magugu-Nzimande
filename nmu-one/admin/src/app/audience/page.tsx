import type { Metadata } from 'next';
import { Audience } from '@/views/Audience';

export const metadata: Metadata = { title: 'Audiences' };

export default function Page() {
  return <Audience />;
}
