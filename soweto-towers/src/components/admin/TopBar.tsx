import Link from 'next/link';
import { logout } from '@/app/admin/actions';
import { Mark } from '@/components/brand/Logo';
import type { StaffSession } from '@/lib/auth/session';
import { ConsoleNav, ConsoleNavView } from './ConsoleNav';
import styles from './admin.module.css';

/** Console chrome. Rendered without a session as the loading shell, then with one. */
export function TopBar({ staff, inboxCount }: { staff: StaffSession | null; inboxCount: number }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.topInner}>
        <Link href="/admin" className={styles.brand} aria-label="Crew console, Today">
          <Mark tone="paper" size={30} />
          <span className={styles.brandText}>
            <span className={styles.brandName}>Soweto Towers</span>
            <span className={styles.brandSub}>Crew console</span>
          </span>
        </Link>
        <div className={styles.who}>
          <Link href="/admin/scan" className={styles.scanQuick}>
            Scan
          </Link>
          {staff && (
            <>
              <Link href="/admin/team#two-step" className={styles.whoName} title={`${staff.email}: password and two-step sign-in`}>
                {staff.name}
              </Link>
              <form action={logout}>
                <button className={styles.ghostDark}>Log out</button>
              </form>
            </>
          )}
        </div>
      </div>
      {staff ? <ConsoleNav isAdmin={staff.role === 'admin'} inboxCount={inboxCount} /> : <ConsoleNavView isAdmin={false} inboxCount={0} pathname={null} />}
    </header>
  );
}
