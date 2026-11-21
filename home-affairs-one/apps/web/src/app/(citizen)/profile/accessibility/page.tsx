import type { Metadata } from 'next';
import { AccessibilityScreen } from './AccessibilityScreen';

export const metadata: Metadata = { title: 'Accessibility and data' };

export default function AccessibilityPage() {
  return <AccessibilityScreen />;
}
