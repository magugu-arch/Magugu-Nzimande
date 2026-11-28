import Link from 'next/link';
import styles from '@/components/content/content.module.css';
import { Photo } from '@/components/ui/Photo';

/** Shown when a page calls notFound(), inside the site's header and footer. */
export default function NotFound() {
  return (
    <section className="section section--tight" aria-labelledby="nf-title">
      <div className="container">
        <div className={styles.band}>
          <Photo slug="bungee-between-towers" sizes="(min-width: 1320px) 1280px, 100vw" focus="50% 35%" />
          <div className={styles.bandShade} />
          <div className={styles.bandBody}>
            <p className="eyebrow">404</p>
            <h1 id="nf-title" className="h1">
              That page took the jump.
            </h1>
            <p>The link may be old, or the page has moved. Everything you need is one step away.</p>
            <div className="cluster">
              <Link href="/" className="btn btn--primary">
                Back to the top
              </Link>
              <Link href="/adventures" className="btn btn--light">
                Adventures
              </Link>
              <Link href="/visit" className="btn btn--ghost" style={{ color: 'var(--on-dark)' }}>
                Plan your visit
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
