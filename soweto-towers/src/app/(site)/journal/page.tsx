import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import styles from '@/components/content/content.module.css';
import { PageHero } from '@/components/site/PageHero';
import { Photo } from '@/components/ui/Photo';
import { articles } from '@/content/journal';
import { formatDayLong } from '@/lib/time';
import { pageMeta } from '@/lib/seo';
import journal from './journal.module.css';

export const metadata: Metadata = pageMeta({
  title: 'Journal: Stories & Visitor Guides',
  description:
    'From the Top stories and visitor guides from Soweto Towers (Orlando Towers): what happens on a first bungee jump, the towers’ two names, and planning a day in Soweto.',
  path: '/journal',
  image: '/og/journal.jpg',
});

export default function JournalPage() {
  const [lead, ...rest] = articles;
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Journal', path: '/journal' }]}
        eyebrow="Journal"
        title="From the top."
        lede="Stories from the bridge, guides for first-timers and ideas for a day in Soweto."
      />

      <section className="section section--tight" aria-label="Articles">
        <div className="container">
          {lead ? (
            <Link href={`/journal/${lead.slug}` as Route} className={journal.lead}>
              <div className={journal.leadMedia}>
                <Photo slug={lead.image} sizes="(min-width: 960px) 60vw, 100vw" eager />
              </div>
              <div className={journal.leadBody}>
                <p className="eyebrow">Featured · {lead.readMinutes} min read</p>
                <h2 className="h2">{lead.title}</h2>
                <p className="lede">{lead.description}</p>
                <span className="link-arrow">Read the story</span>
              </div>
            </Link>
          ) : null}
          <div className={`${styles.cardsAuto} ${styles.mt}`}>
            {rest.map((a, i) => (
              <Link key={a.slug} href={`/journal/${a.slug}` as Route} className={`${journal.card} reveal`} style={{ ['--delay' as string]: `${i * 80}ms` }}>
                <div className={journal.cardMedia}>
                  <Photo slug={a.image} sizes="(min-width: 960px) 50vw, 100vw" />
                </div>
                <div className={journal.cardBody}>
                  <p className="eyebrow">
                    <time dateTime={a.published}>{formatDayLong(a.published)}</time> · {a.readMinutes} min read
                  </p>
                  <h2 className="h3">{a.title}</h2>
                  <p className="muted">{a.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
