'use client';

import { focusMainHeading } from '@hao/accessibility';
import { DEMO } from '@hao/api-contracts';
import { AppLink, Avatar, Container, LinkButton } from '@hao/design-system';
import {
  ClipboardList,
  House,
  LayoutGrid,
  Mail,
  Menu,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { useFlags } from '@/lib/prefs';
import { useGatewayQuery } from '@/lib/queries';
import { usePersonToken, useSession } from '@/lib/session';
import { BrandMark } from './BrandMark';
import styles from './shell.module.css';

/** Always on screen: the prototype must never be mistaken for an official service. */
export function ConceptRibbon() {
  return (
    <div
      className={`${styles.ribbon} on-dark no-print`}
      role="note"
      aria-label="About this prototype"
    >
      <Container className={styles.ribbonInner}>
        <span>
          <strong>Concept prototype</strong>{' '}
          <span className={styles.ribbonShort}>· not an official service · synthetic data</span>
          <span className={styles.ribbonLong}>
            · Not an official Department of Home Affairs service. All people, cases and places are
            synthetic.
          </span>
        </span>
        <AppLink href="/about/">About</AppLink>
      </Container>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/' || href === '/home/') return pathname === href;
  return pathname === href || pathname.startsWith(href);
}

function useUnreadCount(): number {
  const token = usePersonToken();
  const inbox = useGatewayQuery(['inbox', token], (g) => g.notifications.listInbox(token ?? ''), {
    enabled: Boolean(token),
  });
  return inbox.data?.filter((message) => message.readAt === null).length ?? 0;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session, ready } = useSession();
  const { flags } = useFlags();
  const unread = useUnreadCount();
  const signedIn = session?.role === 'citizen';
  const homeHref = signedIn ? '/home/' : '/';

  // After a client-side navigation, move focus to the new page's heading so
  // keyboard and screen-reader users land in the right place.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    focusMainHeading();
  }, [pathname]);

  const desktopNav: Array<{ href: string; label: string }> = [
    { href: homeHref, label: 'Home' },
    { href: '/services/', label: 'Services' },
    { href: '/applications/', label: 'My applications' },
    ...(flags.wallet ? [{ href: '/wallet/', label: 'Wallet' }] : []),
    { href: '/messages/', label: 'Messages' },
    { href: '/service-points/', label: 'Service points' },
    { href: '/help/', label: 'Help' },
  ];

  const tabs: Array<{ href: string; label: string; icon: LucideIcon; badge?: number }> = [
    { href: homeHref, label: 'Home', icon: House },
    { href: '/services/', label: 'Services', icon: LayoutGrid },
    { href: '/applications/', label: 'Applications', icon: ClipboardList },
    { href: '/messages/', label: 'Messages', icon: Mail, badge: unread },
    { href: '/more/', label: 'More', icon: Menu },
  ];

  return (
    <div className={styles.frame}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <ConceptRibbon />
      <header className={`${styles.topbar} no-print`}>
        <Container className={styles.topbarInner}>
          <AppLink href={homeHref} className={styles.brand} aria-label="Home Affairs One, home">
            <BrandMark />
            <span className={styles.brandName}>
              Home Affairs <em>One</em>
            </span>
          </AppLink>
          <nav className={styles.nav} aria-label="Main">
            <ul className={styles.navList}>
              {desktopNav.map((item) => (
                <li key={item.href}>
                  <AppLink
                    href={item.href}
                    className={styles.navLink}
                    aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  >
                    {item.label}
                    {item.href === '/messages/' && unread > 0 ? (
                      <span className="visually-hidden"> ({unread} unread)</span>
                    ) : null}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.topbarEnd}>
            <AppLink href="/search/" className={styles.iconLink} aria-label="Search">
              <Search aria-hidden="true" />
            </AppLink>
            {!ready ? null : signedIn && session ? (
              <AppLink
                href="/profile/"
                className={styles.account}
                aria-label={`Profile: ${session.displayName}`}
              >
                <Avatar initials={session.initials} />
                <span className={styles.accountName}>{session.givenName}</span>
              </AppLink>
            ) : (
              <LinkButton href="/sign-in/" size="sm">
                Sign in
              </LinkButton>
            )}
          </div>
        </Container>
      </header>

      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>

      <footer className={`${styles.footer} on-dark no-print`}>
        <Container>
          <div className={styles.footerGrid}>
            <div>
              <p className={styles.footerBrand}>
                <BrandMark size={28} />
                Home Affairs One
              </p>
              <p>
                A working concept for one trusted front door to identity and civic services. It is
                not an official Department of Home Affairs product, and nothing here is a real
                record, fee, requirement or decision.
              </p>
            </div>
            <nav aria-label="Services">
              <h2>Services</h2>
              <ul>
                <li>
                  <AppLink href="/services/">All services</AppLink>
                </li>
                <li>
                  <AppLink href="/service-points/">Find a service point</AppLink>
                </li>
                <li>
                  <AppLink href="/abroad/">South Africans abroad</AppLink>
                </li>
              </ul>
            </nav>
            <nav aria-label="Help">
              <h2>Help</h2>
              <ul>
                <li>
                  <AppLink href="/help/">Get help</AppLink>
                </li>
                <li>
                  <AppLink href="/help/official-channels/">Official channels and scams</AppLink>
                </li>
                <li>
                  <AppLink href="/profile/accessibility/">Accessibility settings</AppLink>
                </li>
              </ul>
            </nav>
            <nav aria-label="About this prototype">
              <h2>This prototype</h2>
              <ul>
                <li>
                  <AppLink href="/about/">About and image credits</AppLink>
                </li>
                <li>
                  <AppLink href="/staff/">Staff console</AppLink>
                </li>
                {flags.partnerIntegrations ? (
                  <li>
                    <AppLink href="/partner/">Partner sandbox</AppLink>
                  </li>
                ) : null}
              </ul>
            </nav>
          </div>
          <p className={styles.footerSmall}>
            Sample content {DEMO.contentVersion}, effective {DEMO.contentEffectiveDate}. Photographs
            are illustrative concept images and do not show real offices, staff, citizens or
            documents.
          </p>
        </Container>
      </footer>

      <nav className={`${styles.tabbar} no-print`} aria-label="Main (mobile)">
        <ul className={styles.tabList}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <li key={tab.label}>
                <AppLink
                  href={tab.href}
                  className={styles.tab}
                  aria-current={isActive(pathname, tab.href) ? 'page' : undefined}
                >
                  <span className={styles.tabIcon}>
                    <Icon aria-hidden="true" />
                    {tab.badge ? (
                      <span className={styles.badge} aria-hidden="true">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    ) : null}
                  </span>
                  <span>
                    {tab.label}
                    {tab.badge ? (
                      <span className="visually-hidden"> ({tab.badge} unread)</span>
                    ) : null}
                  </span>
                </AppLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
