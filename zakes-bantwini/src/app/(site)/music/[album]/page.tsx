import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArtImage } from '@/components/media/ArtImage';
import { ListenButton } from '@/components/player/ListenButton';
import { albumQueue } from '@/components/player/queue';
import { JsonLd } from '@/components/seo/JsonLd';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ALBUM_KIND_LABEL, Sleeve } from '@/components/ui/Sleeve';
import { getAlbum, getAlbums, getSettings, getStories, getVideos, pick, VIDEO_KIND_LABEL } from '@/content';
import { albumJsonLd, pageMetadata } from '@/lib/seo';
import styles from '../album.module.css';

export async function generateStaticParams() {
  return (await getAlbums()).map((a) => ({ album: a.slug }));
}

export async function generateMetadata(props: PageProps<'/music/[album]'>) {
  const { album: slug } = await props.params;
  const album = await getAlbum(slug);
  if (!album) return {};
  return pageMetadata({ title: album.title, description: album.description, path: `/music/${album.slug}`, image: album.mood });
}

const LINK_LABEL: Record<string, string> = { spotify: 'Spotify', appleMusic: 'Apple Music', youtube: 'YouTube', deezer: 'Deezer' };

function duration(s?: number) {
  return s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';
}

export default async function AlbumPage(props: PageProps<'/music/[album]'>) {
  const { album: slug } = await props.params;
  const album = await getAlbum(slug);
  if (!album) notFound();
  const [settings, videos, stories] = await Promise.all([getSettings(), getVideos(), getStories()]);
  const queue = albumQueue(album, settings);
  const links = Object.entries({ ...settings.streaming, ...album.links }).filter(([, v]) => v) as [string, string][];
  const relatedVideos = pick(videos, album.relatedVideos);
  const relatedStories = pick(stories, album.relatedStories);

  return (
    <>
      <JsonLd data={albumJsonLd(album)} />
      <section className={styles.hero} aria-labelledby="album-title">
        <div className={styles.mood} aria-hidden="true">
          <ArtImage id={album.mood} fill sizes="100vw" overlay="full" decorative />
        </div>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.art}>
            <Sleeve album={album} sizes="(max-width: 860px) 90vw, 40vw" />
          </div>
          <div className={styles.meta}>
            <p className="eyebrow eyebrow-accent">
              {ALBUM_KIND_LABEL[album.kind]} · {album.year ?? 'Year to follow'}
            </p>
            <h1 id="album-title" className="display display-l">
              {album.title}
            </h1>
            <p className="lede">{album.description}</p>
            <div className={styles.actions}>
              <ListenButton queue={queue} className={styles.play} label={`Play ${album.title}`}>
                ▶&nbsp; Play
              </ListenButton>
              {links.map(([k, url]) => (
                <ButtonLink key={k} href={url} variant="outline" small target="_blank" rel="noopener noreferrer">
                  {LINK_LABEL[k] ?? k}
                </ButtonLink>
              ))}
            </div>
            <ApprovalFlag approval={album.approval} label={album.approval === 'placeholder' ? 'Placeholder release — awaiting approved metadata' : undefined} />
          </div>
        </div>
      </section>

      <div className={`container ${styles.body}`}>
        <section aria-labelledby="tracks-title">
          <h2 id="tracks-title" className={styles.h2}>
            Tracklist
          </h2>
          {album.tracks.length === 0 ? (
            <EmptyState title="Tracklist to follow.">
              <p>The tracklist, previews and credits publish here once management supplies the approved release record. Until then, listen on the services above.</p>
            </EmptyState>
          ) : (
            <ol role="list" className={styles.tracks}>
              {album.tracks.map((t, i) => (
                <li key={`${t.title}-${i}`}>
                  <ListenButton queue={queue} start={i} className={styles.trackPlay} label={`Play ${t.title}`}>
                    <span className="mono-num">{String(i + 1).padStart(2, '0')}</span>
                  </ListenButton>
                  <span className={styles.trackTitle}>
                    {t.title}
                    {t.featuring.length > 0 && <span className="muted"> feat. {t.featuring.join(', ')}</span>}
                  </span>
                  <span className="muted mono-num">{duration(t.durationSeconds)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="credits-title">
          <h2 id="credits-title" className={styles.h2}>
            Credits
          </h2>
          {album.credits.length ? (
            <dl className={styles.credits}>
              {album.credits.map((c) => (
                <div key={`${c.role}-${c.name}`}>
                  <dt>{c.role}</dt>
                  <dd>{c.name}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">Credits publish with the approved release record.</p>
          )}
        </section>
      </div>

      {(relatedVideos.length > 0 || relatedStories.length > 0) && (
        <section className={`section ${styles.related}`} aria-labelledby="related-title">
          <div className="container">
            <h2 id="related-title" className={styles.h2}>
              Around the record
            </h2>
            <ul role="list" className={styles.relatedGrid}>
              {relatedVideos.map((v) => (
                <li key={v.slug}>
                  <Link href={`/videos/${v.slug}`} className="zoom-parent" data-cursor="Watch">
                    <ArtImage id={v.poster} hover="zoom" sizes="(max-width: 860px) 100vw, 30vw" ratio={{ desktop: '16/9', mobile: '16/9' }} />
                    <span className="eyebrow eyebrow-accent">{VIDEO_KIND_LABEL[v.kind]}</span>
                    <span className={styles.relatedTitle}>{v.title}</span>
                  </Link>
                </li>
              ))}
              {relatedStories.map((s) => (
                <li key={s.slug}>
                  <Link href={`/journal/${s.slug}`} className="zoom-parent" data-cursor="Open">
                    <ArtImage id={s.hero} hover="zoom" sizes="(max-width: 860px) 100vw, 30vw" ratio={{ desktop: '16/9', mobile: '16/9' }} />
                    <span className="eyebrow eyebrow-accent">Journal</span>
                    <span className={styles.relatedTitle}>{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
