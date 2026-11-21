import type { Metadata } from 'next';
import { AboutScreen } from './AboutScreen';

export const metadata: Metadata = { title: 'About this prototype' };

export default function AboutPage() {
  return <AboutScreen />;
}
