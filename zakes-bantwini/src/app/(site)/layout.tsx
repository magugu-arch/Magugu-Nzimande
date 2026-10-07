import type { ReactNode } from 'react';
import { HomeButton } from '@/components/layout/HomeButton';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { CursorLabel } from '@/components/motion/CursorLabel';
import { RevealObserver } from '@/components/motion/RevealObserver';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { PlayerProvider } from '@/components/player/PlayerProvider';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <HomeButton />
      <MiniPlayer />
      <CursorLabel />
      <RevealObserver />
    </PlayerProvider>
  );
}
