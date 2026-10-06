import Link from 'next/link';
import type { CSSProperties } from 'react';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { EmptyState } from '@/components/ui/EmptyState';
import { getStories, JOURNAL_CATEGORIES, type JournalCategory } from '@/content';
import { pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'Journal',
  description: 'Music, culture, live, people, studio and legacy — the Zakes Bantwini journal.',
  path: '/journal',
  image: 'IMG_6874',
});

export default async function JournalPage(props: PageProps<'/journal'>) {
  const { category } = await props.searchParams;
  const active = JOURNAL_CATEGORIES.find((c) => c.key === category)?.key as JournalCategory | undefined;
  const stories = await getStories(active);
  const label = (k: string) => JOURNAL_CATEGORIES.find((c) => c.key === k)?.label ?? k;

  return (
    <>
      <PageHero eyebrow="Journal" title={['The', 'Journal']} intro="Music, culture, live, people, studio and legacy." media="IMG_6874" overlay="left" />
      <section className="section" aria-label="Stories">
        <div className="container">
          <nav aria-label="Journal categories" className={styles.chapterNav}>
            <Link href="/journal" className={styles.chip} aria-current={!active ? 'page' : undefined}>
              All
            </Link>
            {JOURNAL_CATEGORIES.map((c) => (
              <Link key={c.key} href={`/journal?category=${c.key}`} className={styles.chip} aria-current={active === c.key ? 'page' : undefined}>
                {c.label}
              </Link>
            ))}
          </nav>
          {stories.length === 0 ? (
            <EmptyState title={`No ${active ? label(active).toLowerCase() : ''} stories yet.`} actions={<Link href="/journal" className="link-underline">See every story</Link>}>
              <p>New pieces are published here as they are approved.</p>
            </EmptyState>
          ) : (
            <ul role="list" className={styles.grid3}>
              {stories.map((s, i) => (
                <li key={s.slug} className={styles.card} data-reveal style={{ '--reveal-delay': (i % 3) * 90 } as CSSProperties}>
                  <Link href={`/journal/${s.slug}`} className="zoom-parent" data-cursor="Open">
                    <ArtImage id={s.hero} hover="zoom" sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw" ratio={{ desktop: '4/5', mobile: '4/3' }} />
                    <span className="eyebrow eyebrow-accent">{label(s.category)}</span>
                    <span className={styles.cardTitle}>{s.title}</span>
                    <span className="muted">{s.standfirst}</span>
                  </Link>
                  <ApprovalFlag approval={s.approval} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
