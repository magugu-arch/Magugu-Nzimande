import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Photo } from '@/components/ui/Photo';
import { pageMeta } from '@/lib/seo';
import { FindForm } from './FindForm';
import styles from './page.module.css';

export const metadata: Metadata = pageMeta({
  title: 'Find My Jump: Scream Clips & Videos',
  description:
    'Watch and share your Scream Clip from Soweto Towers (Orlando Towers). Enter your booking reference and email to find your clips, videos and ticket.',
  path: '/find-my-jump',
  image: '/og/find-my-jump.jpg',
});

export default function FindMyJumpPage() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.media}>
        <Photo slug="scream-clip-phone" sizes="(min-width: 960px) 44vw, 100vw" eager />
      </div>
      <div className={styles.body}>
        <p className="eyebrow">#100mClub</p>
        <h1 className="h1">Find my jump.</h1>
        <p className="lede">Your free 10-second Scream Clip lands on WhatsApp after your jump, and it lives here too, with any full edits you bought.</p>
        <Suspense fallback={null}>
          <FindForm />
        </Suspense>
      </div>
    </div>
  );
}
