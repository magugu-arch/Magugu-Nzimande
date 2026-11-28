import { Suspense } from 'react';
import { connection } from 'next/server';
import { Scanner } from '@/components/admin/Scanner';
import styles from '@/components/admin/admin.module.css';
import { requireStaff } from '@/lib/auth/session';

export const metadata = { title: 'Scan tickets' };

async function Gate() {
  await connection();
  await requireStaff();
  return <Scanner />;
}

export default function ScanPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Gate</p>
          <h1 className={styles.pageTitle}>Scan tickets</h1>
          <p className={styles.pageSub}>Green: let them in. Amber: check with the visitor. Red: send them to the office.</p>
        </div>
      </header>
      <section className={styles.panel}>
        <Suspense fallback={<div className={styles.skeleton} />}>
          <Gate />
        </Suspense>
      </section>
    </>
  );
}
