import type { CSSProperties, ReactNode } from 'react';
import { ArtImage } from '@/components/media/ArtImage';
import { HeroMotion } from '@/components/motion/HeroMotion';
import { RevealText } from '@/components/motion/RevealText';
import type { Focal, MediaId, Overlay } from '@/content/media';
import styles from './PageHero.module.css';

type Props = {
  eyebrow: string;
  title: string[];
  intro?: ReactNode;
  media?: MediaId;
  focal?: Focal;
  mobileFocal?: Focal;
  overlay?: Overlay;
  actions?: ReactNode;
  /** `tall` fills the viewport; `short` is for utility pages like booking. */
  size?: 'tall' | 'medium' | 'short';
};

/** The opening frame of an interior page: full-bleed image, masked title. */
export function PageHero({ eyebrow, title, intro, media, focal, mobileFocal, overlay = 'left', actions, size = 'medium' }: Props) {
  return (
    <section className={`${styles.hero} ${styles[size]} ${media ? '' : styles.plain}`} aria-labelledby="page-title">
      {media && (
        <div className={styles.media}>
          <HeroMotion>
            <ArtImage id={media} fill priority sizes="100vw" overlay={overlay} focal={focal} mobileFocal={mobileFocal} />
          </HeroMotion>
        </div>
      )}
      <div className={`container ${styles.inner}`}>
        <p className="eyebrow eyebrow-accent" data-reveal="now">
          {eyebrow}
        </p>
        <RevealText as="h1" id="page-title" lines={title} className={`display ${size === 'short' ? 'display-m' : 'display-l'} ${styles.title}`} delay={80} immediate />
        {intro && (
          <div className={`lede ${styles.intro}`} data-reveal="now" style={{ '--reveal-delay': 300 } as CSSProperties}>
            {intro}
          </div>
        )}
        {actions && (
          <div className={styles.actions} data-reveal="now" style={{ '--reveal-delay': 420 } as CSSProperties}>
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
