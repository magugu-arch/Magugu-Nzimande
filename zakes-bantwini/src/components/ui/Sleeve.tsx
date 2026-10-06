import type { Album } from '@/content';
import { ArtImage } from '@/components/media/ArtImage';
import styles from './ui.module.css';

const KIND: Record<Album['kind'], string> = {
  album: 'Album',
  ep: 'EP',
  single: 'Single',
  compilation: 'Compilation',
  live: 'Live',
};

/**
 * Album artwork. Approved cover art when supplied; until then a sleeve set in
 * type over the release's mood image — never a generated imitation of a cover.
 */
export function Sleeve({ album, sizes = '(max-width: 860px) 80vw, 30vw' }: { album: Album; sizes?: string }) {
  if (album.artwork) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- approved artwork is served as-is from the CMS
      <img
        src={album.artwork.src}
        alt={album.artwork.alt}
        width={album.artwork.width}
        height={album.artwork.height}
        loading="lazy"
        style={{ width: '100%', height: 'auto', aspectRatio: '1' }}
      />
    );
  }
  return (
    <div className={styles.sleeve} role="img" aria-label={`${album.title} — cover artwork to follow`}>
      <ArtImage id={album.mood} fill decorative sizes={sizes} />
      <span className={styles.sleeveRing} aria-hidden="true" />
      <div className={styles.sleeveType} aria-hidden="true">
        <span className={styles.sleeveArtist}>Zakes Bantwini</span>
        <span>
          <span className={styles.sleeveKind}>{KIND[album.kind]}</span>
          <span className={styles.sleeveTitle} style={{ display: 'block', marginTop: '0.25em' }}>
            {album.title}
          </span>
        </span>
      </div>
    </div>
  );
}

export const ALBUM_KIND_LABEL = KIND;
