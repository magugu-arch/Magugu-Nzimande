import type { ReactNode } from 'react';
import { Photo } from '@/components/ui/Photo';
import { image as imageInfo, type ImageSlug } from '@/content/images';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import styles from './PageHero.module.css';

type Props = {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  crumbs: Crumb[];
  /** With a photo: the home-hero treatment, shorter. Without: a quiet header on the canvas. */
  image?: ImageSlug;
  focus?: string;
  actions?: ReactNode;
  /** Right-hand side of the panel on wide screens (price block, facts). */
  aside?: ReactNode;
  notice?: ReactNode;
};

export function PageHero({ eyebrow, title, lede, crumbs, image, focus, actions, aside, notice }: Props) {
  if (!image) {
    return (
      <header className={`container ${styles.plain}`}>
        <Breadcrumbs items={crumbs} />
        {notice}
        <div className={styles.plainBody}>
          <div className={styles.plainText}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="h1">{title}</h1>
            {lede ? <p className="lede">{lede}</p> : null}
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>
          {aside ? <div className={styles.plainAside}>{aside}</div> : null}
        </div>
      </header>
    );
  }

  const art = imageInfo(image);
  return (
    <header className={styles.wrap}>
      <div className={`container ${styles.crumbRow}`}>
        <Breadcrumbs items={crumbs} />
      </div>
      {notice ? <div className="container">{notice}</div> : null}
      <div className={`container ${styles.heroContainer}`}>
        <div className={styles.hero} data-panel={art.wide?.panel ?? 'left'}>
          {/* Phones crop tall and wide screens crop wide, so each gets its own focal point. */}
          <div
            className={styles.media}
            style={{ ['--hero-focus' as string]: focus ?? art.focus, ['--hero-focus-wide' as string]: art.wide?.focus ?? focus ?? art.focus }}
          >
            <Photo slug={image} sizes="(min-width: 1440px) 1392px, 100vw" eager focus="var(--focus-now)" />
          </div>
          <div className={`glass-dark ${styles.panel}`}>
            <div className={styles.text}>
              <p className={`eyebrow ${styles.eyebrow}`}>{eyebrow}</p>
              <h1 className="h1">{title}</h1>
              {lede ? <p className={styles.lede}>{lede}</p> : null}
              {actions ? <div className={styles.actions}>{actions}</div> : null}
            </div>
            {aside ? <div className={styles.aside}>{aside}</div> : null}
          </div>
        </div>
      </div>
    </header>
  );
}
