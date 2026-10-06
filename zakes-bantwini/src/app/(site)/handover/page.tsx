import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { ChapterScroller } from '@/components/motion/ChapterScroller';
import { ButtonLink } from '@/components/ui/Button';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'The Handover',
  description: 'The next chapter of Zakes Bantwini — a story of building for the people who will carry the work forward.',
  path: '/handover',
  image: 'IMG_6886',
});

/*
 * Editorial, not an announcement. The brief is explicit: The Handover is a
 * next-chapter narrative, and no retirement is stated or implied unless
 * management supplies approved wording. This copy is `pending` approval.
 */
const CHAPTERS = [
  {
    id: 'in-motion',
    numeral: 'I',
    title: 'Every chapter begins in motion.',
    media: 'IMG_6854' as const,
    body: ['The work started the way all work starts: one step, then another, through rooms that were not built for you yet.', 'Movement is the first lesson. You keep walking towards the light at the end of the corridor.'],
  },
  {
    id: 'the-monument',
    numeral: 'II',
    title: 'Build something larger than yourself.',
    media: 'IMG_6863' as const,
    body: ['At some point the question changes from “what can I make?” to “what can I build that outlasts the making?”', 'An institution is architecture for other people: a festival, a label, a catalogue, an academy, a community.'],
  },
  {
    id: 'the-people',
    numeral: 'III',
    title: 'A legacy is measured by who it equips.',
    media: 'IMG_6877' as const,
    body: ['The next generation is not an audience. They are the people the work is being handed to — producers, performers, curators and fans.', 'Every room built now is a room they will fill.'],
  },
  {
    id: 'the-handover',
    numeral: 'IV',
    title: 'Not an ending. A continuation.',
    media: 'IMG_6886' as const,
    body: ['A handover is the moment a body of work is entrusted to the people who will carry it — and the beginning of what they make of it.', 'This chapter is still being written.'],
  },
];

export default function HandoverPage() {
  return (
    <>
      <PageHero
        eyebrow="The Handover"
        title={['The next', 'chapter']}
        intro="A story told in chapters — about building, and about who we build for."
        media="IMG_6874"
        overlay="left"
        size="tall"
      />
      <ChapterScroller
        chapters={CHAPTERS.map((c) => ({
          id: c.id,
          numeral: c.numeral,
          title: c.title,
          media: <ArtImage id={c.media} fill sizes="(max-width: 960px) 100vw, 60vw" decorative />,
          body: c.body.map((p) => <p key={p}>{p}</p>),
        }))}
      />
      <section className={`section ${styles.band}`} aria-labelledby="continue-title">
        <div className={`container ${styles.copy}`}>
          <p className="eyebrow eyebrow-accent">Continue</p>
          <h2 id="continue-title" className="statement" data-reveal>
            See what is being built — <em>and join it</em>.
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <ButtonLink href="/architect">The Architect</ButtonLink>
            <ButtonLink href="/community" variant="outline">
              Join the movement
            </ButtonLink>
          </div>
          <ApprovalFlag approval="pending" />
        </div>
      </section>
    </>
  );
}
