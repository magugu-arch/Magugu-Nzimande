import { CommunityForm } from '@/components/forms/PublicForms';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { CONSENT_TEXT } from '@/lib/consent';
import { pageMetadata } from '@/lib/seo';
import { joinCommunity } from '../forms/actions';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'Community',
  description: 'Join the movement: first word on music, live dates and early access from Zakes Bantwini.',
  path: '/community',
  image: 'IMG_6860',
});

const BENEFITS = [
  { title: 'First word', body: 'New music, films and live dates before they are announced anywhere else.' },
  { title: 'Early access', body: 'Ticket windows and releases opened to the community first.' },
  { title: 'A seat at the table', body: 'As the institution grows — festival, academy, label — a membership pathway for the people who carried the music this far.' },
];

export default function CommunityPage() {
  return (
    <>
      <PageHero eyebrow="Community" title={['Join the', 'movement']} intro="A direct line in. Only what is worth receiving, and only how you choose to receive it." media="IMG_6860" overlay="left" />
      <section className="section" aria-labelledby="join-title">
        <div className={`container ${styles.formWrap}`}>
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">What you get</p>
            <h2 id="join-title" className="statement">
              The people in the room, <em>kept close</em>.
            </h2>
            <dl className={styles.facts} style={{ width: '100%' }}>
              {BENEFITS.map((b) => (
                <div key={b.title}>
                  <dt>{b.title}</dt>
                  <dd>{b.body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <CommunityForm action={joinCommunity} consent={CONSENT_TEXT} />
        </div>
      </section>
      <div className={styles.wide} aria-hidden="true">
        <ArtImage id="IMG_6877" fill sizes="100vw" decorative />
      </div>
    </>
  );
}
