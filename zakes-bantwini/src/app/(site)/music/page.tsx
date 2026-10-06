import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { HorizontalRail } from '@/components/motion/HorizontalRail';
import { Parallax } from '@/components/motion/Parallax';
import { ListenButton } from '@/components/player/ListenButton';
import { albumQueue } from '@/components/player/queue';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHead } from '@/components/ui/SectionHead';
import { ALBUM_KIND_LABEL, Sleeve } from '@/components/ui/Sleeve';
import { getAlbums, getSettings } from '@/content';
import { pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';
import home from '../home.module.css';

export const metadata = pageMetadata({
  title: 'Music',
  description: 'The Zakes Bantwini catalogue — releases, credits, tracklists and where to listen.',
  path: '/music',
  image: 'IMG_6881',
});

const LINK_LABEL: Record<string, string> = { spotify: 'Spotify', appleMusic: 'Apple Music', youtube: 'YouTube', deezer: 'Deezer' };

export default async function MusicPage() {
  const [albums, settings] = await Promise.all([getAlbums(), getSettings()]);
  const links = Object.entries(settings.streaming).filter(([, v]) => v) as [string, string][];

  return (
    <>
      <PageHero
        eyebrow="Music"
        title={['The', 'Catalogue']}
        intro="Records built like architecture — foundations, structure and space. Every release, with its artwork, credits and the story behind it."
        media="IMG_6881"
        overlay="left"
        actions={links.length > 0 && (
          <>
            {links.map(([k, url]) => (
              <ButtonLink key={k} href={url} variant="outline" small target="_blank" rel="noopener noreferrer">
                {LINK_LABEL[k] ?? k}
              </ButtonLink>
            ))}
          </>
        )}
      />

      <section className="section" aria-labelledby="intro-title">
        <div className={`container ${styles.split}`}>
          <ArtImage id="IMG_6857" sizes="(max-width: 960px) 100vw, 45vw" ratio={{ desktop: '4/3', mobile: '4/5' }} />
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">The producer’s ear</p>
            <h2 id="intro-title" className="statement" data-reveal>
              Listen the way it was <em>built</em>.
            </h2>
            <p className="body-copy">
              Start anywhere. Each release opens to its credits, tracklist and the films and stories made around it — and plays in the bar at the foot of the page
              while you keep exploring.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="releases-title" className={styles.band}>
        <div className="container section-tight">
          <SectionHead index="01" eyebrow="Releases" id="releases-title" title="Every record" />
        </div>
        {albums.length === 0 ? (
          <div className="container section-tight">
            <EmptyState title="The catalogue is being prepared." actions={<ButtonLink href="/community" variant="outline" small>Hear about new releases first</ButtonLink>}>
              <p>Approved releases, artwork and credits will appear here.</p>
            </EmptyState>
          </div>
        ) : (
          <HorizontalRail label="Releases">
            {albums.map((album) => (
              <article key={album.slug} className={home.release}>
                <Link href={`/music/${album.slug}`} className="zoom-parent" data-cursor="Open">
                  <Sleeve album={album} sizes="(max-width: 860px) 75vw, 28vw" />
                </Link>
                <div className={home.releaseMeta}>
                  <h3>
                    <Link href={`/music/${album.slug}`}>{album.title}</Link>
                  </h3>
                  <p className="muted">
                    {ALBUM_KIND_LABEL[album.kind]} · {album.year ?? 'Year to follow'}
                  </p>
                  <ListenButton queue={albumQueue(album, settings)} className={home.listen} label={`Listen to ${album.title}`}>
                    Listen
                  </ListenButton>
                </div>
                <ApprovalFlag approval={album.approval} />
              </article>
            ))}
          </HorizontalRail>
        )}
      </section>

      <div className={styles.wide} aria-hidden="true">
        <Parallax strength={0.1}>
          <ArtImage id="IMG_6883" fill sizes="100vw" decorative />
        </Parallax>
      </div>

      <section className="section" aria-labelledby="archive-title">
        <div className={`container ${styles.split} ${styles.splitReverse}`}>
          <ArtImage id="IMG_6879" sizes="(max-width: 960px) 100vw, 50vw" ratio={{ desktop: '4/3', mobile: '4/5' }} />
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">From the archive</p>
            <h2 id="archive-title" className="statement" data-reveal>
              A catalogue is a <em>working library</em>.
            </h2>
            <p className="body-copy">Sessions, photographs and the records that shaped them — kept, documented and opened up as the Catalogue pillar grows.</p>
            <ButtonLink href="/journal/what-an-archive-is-for" variant="text" arrow>
              What an archive is for
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
