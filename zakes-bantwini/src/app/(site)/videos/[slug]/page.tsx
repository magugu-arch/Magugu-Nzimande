import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArtImage } from '@/components/media/ArtImage';
import { JsonLd } from '@/components/seo/JsonLd';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { getAlbum, getVideo, getVideos, VIDEO_KIND_LABEL } from '@/content';
import { mediaOgUrl } from '@/content/media';
import { formatDay } from '@/lib/booking/dates';
import { pageMetadata, videoJsonLd } from '@/lib/seo';
import styles from '../../pages.module.css';

export async function generateStaticParams() {
  return (await getVideos()).map((v) => ({ slug: v.slug }));
}

export async function generateMetadata(props: PageProps<'/videos/[slug]'>) {
  const { slug } = await props.params;
  const video = await getVideo(slug);
  if (!video) return {};
  return pageMetadata({ title: video.title, description: video.description, path: `/videos/${video.slug}`, image: video.poster });
}

export default async function VideoPage(props: PageProps<'/videos/[slug]'>) {
  const { slug } = await props.params;
  const video = await getVideo(slug);
  if (!video) notFound();
  const [all, album] = await Promise.all([getVideos(), video.relatedAlbum ? getAlbum(video.relatedAlbum) : undefined]);
  const more = all.filter((v) => v.slug !== video.slug).slice(0, 3);
  const ld = videoJsonLd(video);

  return (
    <>
      {ld && <JsonLd data={ld} />}
      <section style={{ paddingTop: 'var(--header-h)', background: 'var(--black)' }} aria-labelledby="video-title">
        <VideoPlayer
          slug={video.slug}
          title={video.title}
          source={video.source}
          posterUrl={mediaOgUrl(video.poster)}
          poster={<ArtImage id={video.poster} fill priority sizes="100vw" overlay="vignette" />}
        />
        <div className={`container section-tight ${styles.split}`}>
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">
              {VIDEO_KIND_LABEL[video.kind]}
              {video.publishedAt ? ` · ${formatDay(video.publishedAt)}` : ''}
            </p>
            <h1 id="video-title" className="display display-m">
              {video.title}
            </h1>
            <ApprovalFlag approval={video.approval} />
          </div>
          <div className={styles.copy}>
            <p className="lede">{video.description}</p>
            {album && (
              <ButtonLink href={`/music/${album.slug}`} variant="text" arrow>
                From {album.title}
              </ButtonLink>
            )}
            <p className="muted">Keyboard: Space or K to play and pause, F for full screen, M to mute, C for captions, arrow keys to skip.</p>
          </div>
        </div>
      </section>

      {more.length > 0 && (
        <section className={`section ${styles.band}`} aria-labelledby="more-title">
          <div className="container">
            <h2 id="more-title" className="eyebrow" style={{ marginBottom: 24 }}>
              More films
            </h2>
            <ul role="list" className={styles.grid3}>
              {more.map((v) => (
                <li key={v.slug} className={styles.card}>
                  <Link href={`/videos/${v.slug}`} className="zoom-parent" data-cursor="Watch">
                    <ArtImage id={v.poster} hover="zoom" sizes="(max-width: 600px) 100vw, 33vw" ratio={{ desktop: '16/9', mobile: '16/9' }} />
                    <span className="eyebrow eyebrow-accent">{VIDEO_KIND_LABEL[v.kind]}</span>
                    <span className={styles.cardTitle}>{v.title}</span>
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
