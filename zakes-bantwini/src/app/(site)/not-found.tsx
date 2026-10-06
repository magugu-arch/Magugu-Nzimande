import { ArtImage } from '@/components/media/ArtImage';
import { ButtonLink } from '@/components/ui/Button';
import styles from './pages.module.css';

export default function NotFound() {
  return (
    <section className={styles.fullBleed} style={{ minHeight: '100svh' }} aria-labelledby="nf-title">
      <ArtImage id="IMG_6888" fill sizes="100vw" overlay="full" decorative />
      <div className={`container ${styles.fullBleedInner}`}>
        <p className="eyebrow eyebrow-accent">404</p>
        <h1 id="nf-title" className="display display-l">
          Wrong turn
        </h1>
        <p className="lede">This room does not exist — or it has moved. The rest of the building is open.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/book" variant="outline">
            Book Zakes
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
