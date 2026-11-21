import type { Metadata } from 'next';
import { PrototypeScreen } from './PrototypeScreen';

export const metadata: Metadata = { title: 'Prototype controls' };

export default function PrototypePage() {
  return <PrototypeScreen />;
}
