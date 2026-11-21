import type { Metadata } from 'next';
import { OfficialChannelsScreen } from './OfficialChannelsScreen';

export const metadata: Metadata = { title: 'Know the official channels' };

export default function OfficialChannelsPage() {
  return <OfficialChannelsScreen />;
}
