import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { LoginForm } from '@/components/admin/LoginForm';
import { Mark } from '@/components/brand/Logo';
import styles from '@/components/admin/admin.module.css';
import { isDemoDatabase } from '@/lib/db';
import { DEMO_STAFF } from '@/lib/db/seed';

export const metadata: Metadata = { title: 'Sign in' };

async function DemoNote() {
  await connection();
  if (!isDemoDatabase()) return null;
  return (
    <p className={styles.demoNote}>
      Preview database: sign in as <strong>{DEMO_STAFF.email}</strong> with password <strong>{DEMO_STAFF.password}</strong>. This account only exists in
      previews.
    </p>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Mark size={40} />
          <div>
            <p className="eyebrow">Soweto Towers</p>
            <h1 className="h2" style={{ fontSize: '1.9rem' }}>
              Crew sign-in
            </h1>
          </div>
        </div>
        <LoginForm />
        <Suspense fallback={null}>
          <DemoNote />
        </Suspense>
      </div>
    </main>
  );
}
