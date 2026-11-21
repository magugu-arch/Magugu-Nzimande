import type { Metadata } from 'next';
import { HelpScreen } from './HelpScreen';

export const metadata: Metadata = { title: 'Get help' };

export default function HelpPage() {
  return <HelpScreen />;
}
