import styles from './content.module.css';

/**
 * What a client navigation shows while a slug page streams in. Direct visits to known slugs are
 * prerendered in full, so search engines and first loads never see this.
 */
export function PageSkeleton({ variant }: { variant: 'photo' | 'article' }) {
  if (variant === 'article') {
    return (
      <div className={styles.skeleton} aria-busy="true">
        <span className="visually-hidden">Loading article…</span>
        <div className="container--narrow" style={{ display: 'grid', gap: 16 }}>
          <span className={styles.skelLine} />
          <span className={`${styles.skelLine} ${styles.skelTitle}`} />
          <span className={`${styles.skelLine} ${styles.skelShort}`} />
        </div>
        <div className="container">
          <div className={`${styles.skelBlock} ${styles.skelFigure}`} />
        </div>
      </div>
    );
  }
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="visually-hidden">Loading…</span>
      <div className="container">
        <span className={styles.skelLine} />
      </div>
      <div className={`${styles.skelBlock} ${styles.skelHero}`} />
    </div>
  );
}
