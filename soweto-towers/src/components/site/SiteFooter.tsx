import Link from 'next/link';
import { LogoStacked } from '@/components/brand/Logo';
import { ArrowUpRight, FacebookGlyph, InstagramGlyph, Mail, Phone, Pin, TikTokGlyph, WhatsAppGlyph, YouTubeGlyph } from '@/components/ui/icons';
import { footerColumns, legalNav } from '@/content/nav';
import { directions, site, whatsappLink } from '@/content/site';
import { weeklyHoursSummary } from '@/lib/hours';
import { NewsletterForm } from './NewsletterForm';
import { currentYear } from '@/lib/cached-time';
import styles from './SiteFooter.module.css';

export async function SiteFooter() {
  const year = await currentYear();
  const socials = [
    { href: site.socials.instagram, label: 'Instagram', Icon: InstagramGlyph },
    { href: site.socials.tiktok, label: 'TikTok', Icon: TikTokGlyph },
    { href: site.socials.facebook, label: 'Facebook', Icon: FacebookGlyph },
    { href: site.socials.youtube, label: 'YouTube', Icon: YouTubeGlyph },
  ].filter((s) => s.href);

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <LogoStacked tone="paper" width={220} descriptor />
            <p className={`h2 ${styles.tagline}`}>Soweto, from the top.</p>
            <p className={styles.aka}>
              Soweto Towers is the adventure centre on the Orlando Towers, the painted cooling towers of the old Orlando Power Station in Orlando East, Soweto.
            </p>
            <div className="cluster">
              <Link href="/book" className="btn btn--primary">
                Book your jump
              </Link>
              <a className="btn btn--ghost" href={whatsappLink('Hi Soweto Towers! ')} target="_blank" rel="noopener">
                <WhatsAppGlyph size={18} /> WhatsApp
              </a>
            </div>
          </div>

          <div className={styles.visitCol}>
            <h2 className={styles.colTitle}>Visit</h2>
            <dl className={styles.hours}>
              {weeklyHoursSummary().map((h) => (
                <div key={h.label}>
                  <dt>{h.label}</dt>
                  <dd>{h.value}</dd>
                </div>
              ))}
            </dl>
            <address className={styles.address}>
              <Pin width={18} height={18} />
              <span>
                {site.address.street}
                <br />
                {site.address.suburb}, {site.address.city}, {site.address.metro}
              </span>
            </address>
            <div className={styles.dirLinks}>
              <a href={directions.google} target="_blank" rel="noopener">
                Google Maps <ArrowUpRight width={14} height={14} />
              </a>
              <a href={directions.apple} target="_blank" rel="noopener">
                Apple Maps <ArrowUpRight width={14} height={14} />
              </a>
              <a href={directions.waze} target="_blank" rel="noopener">
                Waze <ArrowUpRight width={14} height={14} />
              </a>
            </div>
            <p className={styles.note}>Entrance R{site.entranceFee} per person. The site is cash-free: please pay by card.</p>
          </div>
        </div>

        <div className={styles.columns}>
          {footerColumns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className={styles.colTitle}>{col.title}</h2>
              <ul role="list">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h2 className={styles.colTitle}>Talk to us</h2>
            <ul role="list" className={styles.contactList}>
              <li>
                <a href={`tel:${site.phone.e164}`}>
                  <Phone width={18} height={18} /> {site.phone.display}
                </a>
              </li>
              <li>
                <a href={`tel:${site.phoneAlt.e164}`}>
                  <Phone width={18} height={18} /> {site.phoneAlt.display}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`}>
                  <Mail width={18} height={18} /> {site.email}
                </a>
              </li>
            </ul>
            <NewsletterForm />
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.socials}>
            {socials.map(({ href, label, Icon }) => (
              <a key={label} href={href} aria-label={`Soweto Towers on ${label}`} target="_blank" rel="noopener">
                <Icon size={20} />
              </a>
            ))}
            <span className={styles.tags}>{site.hashtags.join('  ')}</span>
          </div>
          <div className={styles.legal}>
            <span>© {year} Soweto Towers (Orlando Towers), Soweto</span>
            {legalNav.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
