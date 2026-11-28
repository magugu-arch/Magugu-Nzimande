import { Suspense } from 'react';
import { TopBar } from '@/components/admin/TopBar';
import styles from '@/components/admin/admin.module.css';
import { requireStaff } from '@/lib/auth/session';
import { inboxCounts } from '@/lib/data/admin';

async function SignedInBar() {
  const staff = await requireStaff();
  const counts = await inboxCounts();
  return <TopBar staff={staff} inboxCount={counts.total} />;
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<TopBar staff={null} inboxCount={0} />}>
        <SignedInBar />
      </Suspense>
      <main className={styles.main} id="main">
        {children}
      </main>
    </div>
  );
}
