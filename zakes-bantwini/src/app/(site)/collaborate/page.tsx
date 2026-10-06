import { CollaborationForm } from '@/components/forms/PublicForms';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { COLLABORATION_TYPES } from '@/lib/booking/types';
import { pageMetadata } from '@/lib/seo';
import { submitCollaboration } from '../forms/actions';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'Collaborate',
  description: 'Brand partnerships, music collaborations, cultural projects, festivals, content, production and media with Zakes Bantwini.',
  path: '/collaborate',
  image: 'IMG_6876',
});

export default function CollaboratePage() {
  return (
    <>
      <PageHero
        eyebrow="Collaborate"
        title={['Build', 'with us']}
        intro="Brands, artists, festivals and cultural institutions — for work that is made carefully and meant to last."
        media="IMG_6876"
        overlay="left"
      />
      <section className="section" aria-labelledby="form-title">
        <div className={`container ${styles.formWrap}`}>
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">Opportunities</p>
            <h2 id="form-title" className="statement">
              Tell us what you want <em>to make</em>.
            </h2>
            <ul role="list" className={styles.downloads} style={{ width: '100%' }}>
              {COLLABORATION_TYPES.map((t) => (
                <li key={t.key}>
                  <span>{t.label}</span>
                </li>
              ))}
            </ul>
            <ArtImage id="IMG_6887" sizes="(max-width: 960px) 100vw, 38vw" ratio={{ desktop: '4/3', mobile: '4/3' }} />
            <p className="muted">Booking a performance instead? Use the booking request — it is faster.</p>
          </div>
          <CollaborationForm action={submitCollaboration} />
        </div>
      </section>
    </>
  );
}
