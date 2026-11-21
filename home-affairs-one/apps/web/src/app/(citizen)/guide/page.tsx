import type { Metadata } from 'next';
import { GuideScreen } from './GuideScreen';

export const metadata: Metadata = { title: 'Service guide' };

export default function GuidePage() {
  return <GuideScreen />;
}
