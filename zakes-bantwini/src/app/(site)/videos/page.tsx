import Link from 'next/link';
import type { CSSProperties } from 'react';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { getSettings, getVideos, VIDEO_KIND_LABEL } from '@/content';
import { pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'Videos',
  description: 'Official videos, live films and behind-the-scenes from Zakes Bantwini.',
  path: '/videos',
  image: 'IMG_6880',
});

export default async function VideosPage() {
  const [videos, settings] = await Promise.all([getVideos(), getSettings()]);
  const [lead, ...rest] = videos;

  return (
    <>
      <PageHero
        eyebrow="Videos"
        title={['Films', 'and frames']}
        intro="Official videos, live films and the work behind the camera."
        media="IMG_6880"
        overlay="left"
        actions={
          settings.streaming.youtube && (
            <ButtonLink href={settings.streaming.youtube} variant="outline" small target="_blank" rel="noopener noreferrer">
              YouTube
            </ButtonLink>
          )
        }
      />

      <section className="section" aria-label="All videos">
        <div className="container">
          {!lead ? (
            <EmptyState title="Films are on their way.">
              <p>Approved videos will appear here with captions.</p>
            </EmptyState>
          ) : (
            <>
              <article className={styles.featured}>
                <Link href={`/videos/${lead.slug}`} className="zoom-parent" data-cursor="Watch">
                  <ArtImage id={lead.poster} hover="zoom" priority sizes="(max-width: 960px) 100vw, 62vw" ratio={{ desktop: '16/9', mobile: '16/9' }} />
                </Link>
                <div className={styles.copy}>
                  <p className="eyebrow eyebrow-accent">{VIDEO_KIND_LABEL[lead.kind]}</p>
                  <h2 className="statement">
                    <Link href={`/videos/${lead.slug}`}>{lead.title}</Link>
                  </h2>
                  <p className="muted">{lead.description}</p>
                  <ButtonLink href={`/videos/${lead.slug}`} cursor="Watch">
                    Watch
                  </ButtonLink>
                  <ApprovalFlag approval={lead.approval} />
                </div>
              </article>
              <ul role="list" className={styles.grid3}>
                {rest.map((v, i) => (
                  <li key={v.slug} className={styles.card} data-reveal style={{ '--reveal-delay': (i % 3) * 100 } as CSSProperties}>
                    <Link href={`/videos/${v.slug}`} className="zoom-parent" data-cursor="Watch">
                      <ArtImage id={v.poster} hover="zoom" sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw" ratio={{ desktop: '16/9', mobile: '16/9' }} />
                      <span className="eyebrow eyebrow-accent">{VIDEO_KIND_LABEL[v.kind]}</span>
                      <span className={styles.cardTitle}>{v.title}</span>
                    </Link>
                    <ApprovalFlag approval={v.approval} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className={`section ${styles.band}`} aria-labelledby="direct-title">
        <div className={`container ${styles.split}`}>
          <ArtImage id="IMG_6859" sizes="(max-width: 960px) 100vw, 45vw" ratio={{ desktop: '4/3', mobile: '4/5' }} />
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">Behind the camera</p>
            <h2 id="direct-title" className="statement" data-reveal>
              A video is a second arrangement of the song — <em>for the eye</em>.
            </h2>
            <ButtonLink href="/journal/directing-the-frame" variant="text" arrow>
              Directing the frame
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
