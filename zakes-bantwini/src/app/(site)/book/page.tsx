import type { CSSProperties } from 'react';
import { CalendarPreview } from '@/components/booking/CalendarPreview';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHead } from '@/components/ui/SectionHead';
import { pageMetadata } from '@/lib/seo';
import { EVENT_TYPES } from '@/lib/booking/types';
import styles from './book.module.css';

export const metadata = pageMetadata({
  title: 'Book Zakes',
  description: 'Book Zakes Bantwini for corporate, private, festival and brand events. Check a date, send your brief and receive a formal quote.',
  path: '/book',
  image: 'IMG_6873',
});

/** Brief §05 — the twelve steps, grouped into the four moments a buyer experiences. */
const PHASES = [
  { title: 'Request', steps: ['Check preferred date', 'Choose event type', 'Capture event details', 'Location and travel', 'Review request'] },
  { title: 'Review and quote', steps: ['Management review', 'Formal quote'] },
  { title: 'Agreement and deposit', steps: ['Client acceptance', 'Agreement and signature', 'Deposit payment'] },
  { title: 'Confirmed', steps: ['Booking confirmation', 'Event reminders'] },
];

const FAQ = [
  {
    q: 'Is my date held when I send a request?',
    a: 'No. A request starts the conversation. Management may place a short provisional hold while preparing your quote; the date is secured once the agreement is signed, the deposit is received and management confirms.',
  },
  {
    q: 'What does the quote include?',
    a: 'The performance fee, travel, accommodation, production and any additional costs, tax where applicable, the total, the deposit and balance, the payment deadline and the cancellation terms.',
  },
  {
    q: 'How do I pay the deposit?',
    a: 'From your private booking page, through a secure South African payment provider. Card details go straight to the provider — they never touch this website.',
  },
  {
    q: 'Who sees my information?',
    a: 'Only the management team handling your booking. The public calendar shows whether a date can be requested — never who has booked it or why.',
  },
];

export default function BookPage() {
  return (
    <>
      <PageHero
        eyebrow="Book Zakes"
        title={['Bring the', 'Architect', 'to your stage']}
        intro="Corporate, private, festival and brand events. A transparent, professional process — from first date check to confirmed booking."
        media="IMG_6873"
        overlay="left"
        actions={
          <>
            <ButtonLink href="/book/request" cursor="Book">
              Start a booking request
            </ButtonLink>
            <ButtonLink href="#availability" variant="outline">
              Check a date
            </ButtonLink>
          </>
        }
      />

      <section id="availability" className="section" aria-labelledby="availability-title">
        <div className="container">
          <SectionHead
            index="01"
            eyebrow="Availability"
            id="availability-title"
            title="Check a date"
            intro="Availability only — no private booking details are ever shown. Choose a date to start your request."
          />
          <CalendarPreview />
        </div>
      </section>

      <section className={`section ${styles.process}`} aria-labelledby="process-title">
        <div className="container">
          <SectionHead index="02" eyebrow="How it works" id="process-title" title="Not a contact form" intro="A booking is a professional transaction. Every step is clear, and you can see where yours stands at any time." />
          <ol role="list" className={styles.phases}>
            {PHASES.map((phase, i) => {
              const offset = PHASES.slice(0, i).reduce((n, p) => n + p.steps.length, 0);
              return (
                <li key={phase.title} className={styles.phase} data-reveal style={{ '--reveal-delay': i * 100 } as CSSProperties}>
                  <h3 className={styles.phaseTitle}>{phase.title}</h3>
                  <ol role="list" start={offset + 1}>
                    {phase.steps.map((s, j) => (
                      <li key={s}>
                        <span className={styles.stepNum}>{String(offset + j + 1).padStart(2, '0')}</span> {s}
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="occasions-title">
        <div className={`container ${styles.occasions}`}>
          <div className={styles.occasionImages}>
            <ArtImage id="IMG_6862" sizes="(max-width: 860px) 100vw, 45vw" ratio={{ desktop: '4/3', mobile: '4/5' }} />
            <ArtImage id="IMG_6869" sizes="(max-width: 860px) 50vw, 20vw" className={styles.portrait} />
          </div>
          <div>
            <p className="eyebrow">
              <span className="eyebrow-accent">03</span> &nbsp;Occasions
            </p>
            <h2 id="occasions-title" className="statement" data-reveal>
              From the ballroom to the <em>festival field</em>.
            </h2>
            <ul role="list" className={styles.types}>
              {EVENT_TYPES.filter((t) => t.key !== 'other').map((t) => (
                <li key={t.key}>{t.label}</li>
              ))}
            </ul>
            <ButtonLink href="/book/request" arrow cursor="Book">
              Start your request
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className={`section ${styles.faqSection}`} aria-labelledby="faq-title">
        <div className="container">
          <SectionHead index="04" eyebrow="Questions" id="faq-title" title="Before you book" />
          <div className={styles.faq}>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
