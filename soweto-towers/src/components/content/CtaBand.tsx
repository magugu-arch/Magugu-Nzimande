import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { Photo } from '@/components/ui/Photo';
import type { ImageSlug } from '@/content/images';
import styles from './content.module.css';

/** Closing call to action on a photo: one clear next step per page. */
export function CtaBand({
  image,
  eyebrow,
  title,
  text,
  href = '/book',
  label = 'Book your jump',
  secondary,
  headingId,
}: {
  image: ImageSlug;
  eyebrow: string;
  title: string;
  text?: ReactNode;
  href?: string;
  label?: string;
  secondary?: ReactNode;
  headingId: string;
}) {
  return (
    <section className="section section--tight" aria-labelledby={headingId}>
      <div className="container">
        <div className={styles.band}>
          <Photo slug={image} sizes="(min-width: 1320px) 1280px, 100vw" />
          <div className={styles.bandShade} />
          <div className={`${styles.bandBody} reveal`}>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={headingId} className="h1">
              {title}
            </h2>
            {text ? <p>{text}</p> : null}
            <div className="cluster">
              <Link href={href as Route} className="btn btn--primary btn--lg">
                {label}
              </Link>
              {secondary}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
