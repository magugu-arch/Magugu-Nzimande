import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { Parallax } from '@/components/motion/Parallax';
import { JsonLd } from '@/components/seo/JsonLd';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { getPressKit } from '@/content';
import { pageMetadata, personJsonLd } from '@/lib/seo';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'The Story',
  description: 'Zakes Bantwini — South African artist, producer, founder and curator. The music, the method and what it builds.',
  path: '/story',
  image: 'IMG_6855',
});

/*
 * Biography written to the brief's positioning, without dates, chart claims,
 * awards or quotes — those come from management's approved biography, which
 * replaces the press kit's `longBio` and flips its approval.
 */
const CHAPTERS = [
  {
    eyebrow: 'Origin',
    title: ['South African, ', 'first and always.'],
    body: 'Every scene starts somewhere specific — a city, a set of streets, a few rooms where people gather to hear what is new. The music was made here first, then carried outward.',
    media: 'IMG_6872' as const,
    wide: true,
  },
  {
    eyebrow: 'The producer',
    title: ['A record is ', 'architecture.'],
    body: 'Foundations, structure, space and light. The producer’s job is to decide what carries the weight and where the air gets in — at the console, in rehearsal and on stage.',
    media: 'IMG_6858' as const,
  },
  {
    eyebrow: 'Creative philosophy',
    title: ['Build the room, ', 'then fill it.'],
    body: 'Good work is made with other people. The sessions that matter have the right people in the room, a clear idea of what everyone is listening for, and space for someone new to be heard.',
    media: 'IMG_6878' as const,
  },
  {
    eyebrow: 'Cultural impact',
    title: ['Measured by ', 'who it reaches.'],
    body: 'Beyond the stage, the work shows up in crowds that sing back, in young producers who learn a craft, and in the communities that gather around the music.',
    media: 'IMG_6860' as const,
  },
];

export default async function StoryPage() {
  const kit = await getPressKit();

  return (
    <>
      <JsonLd data={personJsonLd()} />
      <PageHero
        eyebrow="The Story"
        title={['More than', 'a performer']}
        intro="Artist, producer, founder, curator — and the architect of what comes next."
        media="IMG_6850"
        overlay="left"
        size="tall"
      />

      <section className="section" aria-labelledby="intro-title">
        <div className={`container ${styles.split}`}>
          <ArtImage id="IMG_6855" sizes="(max-width: 960px) 100vw, 42vw" />
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">Zakes Bantwini</p>
            <h2 id="intro-title" className="statement" data-reveal>
              The music came first. <em>What it builds</em> is the next chapter.
            </h2>
            {kit && (
              <div className="body-copy">
                {kit.longBio.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            )}
            {kit && <ApprovalFlag approval={kit.approval} label="Biography pending management approval" />}
          </div>
        </div>
      </section>

      {CHAPTERS.map((c, i) =>
        c.wide ? (
          <section key={c.eyebrow} className={styles.fullBleed} aria-labelledby={`story-${i}`}>
            <Parallax strength={0.1}>
              <ArtImage id={c.media} fill sizes="100vw" overlay="bottom" decorative />
            </Parallax>
            <div className={`container ${styles.fullBleedInner}`}>
              <p className="eyebrow eyebrow-accent">
                0{i + 1} &nbsp;{c.eyebrow}
              </p>
              <h2 id={`story-${i}`} className="statement" data-reveal>
                {c.title[0]}
                <em>{c.title[1]}</em>
              </h2>
              <p className="lede">{c.body}</p>
            </div>
          </section>
        ) : (
          <section key={c.eyebrow} className={`section ${i % 2 ? styles.band : ''}`} aria-labelledby={`story-${i}`}>
            <div className={`container ${styles.split} ${i % 2 === 0 ? styles.splitReverse : ''}`}>
              <ArtImage id={c.media} sizes="(max-width: 960px) 100vw, 50vw" ratio={{ desktop: '4/3', mobile: '4/5' }} />
              <div className={styles.copy}>
                <p className="eyebrow eyebrow-accent">
                  0{i + 1} &nbsp;{c.eyebrow}
                </p>
                <h2 id={`story-${i}`} className="statement" data-reveal>
                  {c.title[0]}
                  <em>{c.title[1]}</em>
                </h2>
                <p className="body-copy">{c.body}</p>
              </div>
            </div>
          </section>
        ),
      )}

      <section className={styles.fullBleed} aria-labelledby="film-title">
        <ArtImage id="IMG_6880" fill sizes="100vw" overlay="bottom" decorative />
        <div className={`container ${styles.fullBleedInner}`}>
          <p className="eyebrow eyebrow-accent">Next</p>
          <h2 id="film-title" className="statement" data-reveal>
            From performer to <em>architect</em>.
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <ButtonLink href="/architect">The Architect</ButtonLink>
            <ButtonLink href="/press" variant="outline">
              Press / EPK
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
