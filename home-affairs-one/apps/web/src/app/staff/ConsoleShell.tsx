'use client';

import { focusMainHeading } from '@hao/accessibility';
import { AppLink, Avatar, Button, Container } from '@hao/design-system';
import { ArrowUpRight, LockKeyhole, type LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { ConceptRibbon } from '@/components/shell/AppShell';
import { BrandMark } from '@/components/shell/BrandMark';
import styles from './console.module.css';

export interface ConsoleNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other paths that belong to this item, e.g. a case opened from the queue. */
  alsoUnder?: string[];
}

export interface ConsoleShellProps {
  /** The label that names this surface, e.g. "Staff console (concept)". */
  surface: string;
  /** Where the brand link goes. */
  homeHref: string;
  /** Who is signed in to this surface, or `null`. */
  account: { initials: string; name: string; detail?: string } | null;
  onSignOut: () => void;
  /** Only shown while someone is signed in. */
  nav?: ConsoleNavItem[];
  navLabel?: string;
  /** The slim line under the bar. */
  line: ReactNode;
  children: ReactNode;
}

const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

function currentFor(pathname: string, item: ConsoleNavItem): 'page' | 'true' | undefined {
  const here = trim(pathname);
  if (here === trim(item.href)) return 'page';
  const under = [item.href, ...(item.alsoUnder ?? [])].some((path) =>
    here.startsWith(`${trim(path)}/`),
  );
  const alsoHere = (item.alsoUnder ?? []).some((path) => here === trim(path));
  return under || alsoHere ? 'true' : undefined;
}

/**
 * The frame shared by the staff console and the partner sandbox. It is not the
 * public shell: a navy bar, a plain label saying which surface this is, and no
 * citizen navigation. The concept ribbon stays on top, as everywhere.
 */
export function ConsoleShell({
  surface,
  homeHref,
  account,
  onSignOut,
  nav,
  navLabel = 'Console',
  line,
  children,
}: ConsoleShellProps) {
  const pathname = usePathname();

  // After a client-side navigation, move focus to the new page's heading.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    focusMainHeading();
  }, [pathname]);

  return (
    <div className={styles.frame}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <ConceptRibbon />
      <header className={`${styles.bar} on-dark no-print`}>
        <Container className={styles.barInner}>
          <AppLink href={homeHref} className={styles.brand}>
            <span className={styles.brandMark}>
              <BrandMark />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Home Affairs One</span>
              <span className={styles.surface}>{surface}</span>
            </span>
          </AppLink>
          <div className={styles.barEnd}>
            {account ? (
              <div className={styles.who}>
                <Avatar initials={account.initials} tone="gold" />
                <span className={styles.whoText}>
                  <span className={styles.whoName}>
                    <span className="visually-hidden">Signed in as </span>
                    {account.name}
                  </span>
                  {account.detail ? (
                    <span className={styles.whoDetail}>{account.detail}</span>
                  ) : null}
                </span>
                <Button variant="inverseOutline" size="sm" onClick={onSignOut}>
                  Sign out
                </Button>
              </div>
            ) : null}
            <AppLink href="/" className={styles.barLink}>
              Public service
              <ArrowUpRight aria-hidden="true" />
            </AppLink>
          </div>
        </Container>
        {account && nav?.length ? (
          <nav className={styles.nav} aria-label={navLabel}>
            <Container>
              <ul className={styles.navList}>
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <AppLink
                        href={item.href}
                        className={styles.navLink}
                        aria-current={currentFor(pathname, item)}
                      >
                        <Icon aria-hidden="true" />
                        {item.label}
                      </AppLink>
                    </li>
                  );
                })}
              </ul>
            </Container>
          </nav>
        ) : null}
      </header>
      <div className={`${styles.official} no-print`}>
        <Container className={styles.officialInner}>
          <LockKeyhole aria-hidden="true" />
          <p>{line}</p>
        </Container>
      </div>

      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
