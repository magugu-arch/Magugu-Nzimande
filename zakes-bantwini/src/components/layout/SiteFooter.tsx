import Link from 'next/link';
import { ArtImage } from '@/components/media/ArtImage';
import { getSettings } from '@/content';
import { SITE_LINE } from '@/lib/site';
import styles from './SiteFooter.module.css';

const COLUMNS = [
  {
    title: 'Listen and watch',
    links: [
      { href: '/music', label: 'Music' },
      { href: '/videos', label: 'Videos' },
      { href: '/live', label: 'Live' },
      { href: '/journal', label: 'Journal' },
    ],
  },
  {
    title: 'The work',
    links: [
      { href: '/story', label: 'The Story' },
      { href: '/architect', label: 'The Architect' },
      { href: '/handover', label: 'The Handover' },
      { href: '/community', label: 'Community' },
    ],
  },
  {
    title: 'Work with Zakes',
    links: [
      { href: '/book', label: 'Book Zakes' },
      { href: '/press', label: 'Press / EPK' },
      { href: '/collaborate', label: 'Collaborate' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
];

export async function SiteFooter() {
  const settings = await getSettings();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.band}>
        <ArtImage id="IMG_6886" fill sizes="100vw" overlay="full" decorative />
        <div className={`container ${styles.bandInner}`}>
          <p className="statement" data-reveal>
            {SITE_LINE.split('. ')[0]}.<br />
            <em>{SITE_LINE.split('. ')[1]}</em>
          </p>
          <div className={styles.bandActions}>
            <Link href="/book" className={styles.primary} data-cursor="Book">
              Book Zakes
            </Link>
            <Link href="/community" className={styles.secondary}>
              Join the movement
            </Link>
          </div>
        </div>
      </div>

      <div className="container">
        <div className={styles.grid}>
          <div className={styles.brand}>
            <p className={styles.wordmark}>Zakes Bantwini</p>
            <p className="eyebrow eyebrow-accent">The Architect</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className={styles.col}>
              <p className="eyebrow">{col.title}</p>
              <ul role="list">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className={styles.base}>
          <p>© {year} Zakes Bantwini. All rights reserved.</p>
          {settings.social.length > 0 && (
            <ul role="list" className={styles.social} aria-label="Social">
              {settings.social.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="me noopener" target="_blank">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin" className={styles.admin}>
            Management
          </Link>
        </div>
      </div>
    </footer>
  );
}
