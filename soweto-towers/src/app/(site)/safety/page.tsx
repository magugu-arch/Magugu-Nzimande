import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { CtaBand } from '@/components/content/CtaBand';
import styles from '@/components/content/content.module.css';
import { PageHero } from '@/components/site/PageHero';
import { FaqList } from '@/components/ui/FaqList';
import { ArrowUpRight, Rain, Scale, Shield, Users } from '@/components/ui/icons';
import { Photo } from '@/components/ui/Photo';
import { SectionHead } from '@/components/ui/SectionHead';
import { activities, medicalExclusions } from '@/content/catalog';
import { faqs } from '@/content/faq';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Safety: Weight, Age & Weather Rules',
  description:
    'How Soweto Towers (Orlando Towers) keeps every jump safe: weight checked before you pay and again on the bridge, jump masters, one jumper at a time, weather holds and lightning detectors.',
  path: '/safety',
  image: '/og/safety.jpg',
});

export default function SafetyPage() {
  const limited = activities.filter((a) => a.rules.minWeightKg || a.rules.minAge || a.rules.consentUnder);
  const safetyFaqs = faqs.filter((f) => f.group === 'Safety');

  return (
    <>
      <PageHero
        crumbs={[{ name: 'Safety', path: '/safety' }]}
        image="harness-check"
        eyebrow="Safe hands"
        title="Fear is the barrier. Safety is our job."
        lede="Being scared is part of it. Being unsure isn’t. Here is exactly how the crew looks after you, from booking to the bridge."
        actions={
          <Link href="/book" className="btn btn--primary btn--lg">
            Book your jump
          </Link>
        }
      />

      <section className="section" aria-labelledby="process-title">
        <div className={`container ${styles.split}`}>
          <div className={`${styles.splitBody} ${styles.sticky} reveal`}>
            <p className="eyebrow">The process</p>
            <h2 id="process-title" className="h2">
              Six checks before you fall.
            </h2>
            <p className="lede">
              Soweto Towers is run by directors with more than 15 years each in the adventure sport industry, and safety remains our number one priority.
            </p>
            <div className={`frame ${styles.splitMedia}`} style={{ width: '100%' }}>
              <Photo slug="before-the-drop" sizes="(min-width: 960px) 40vw, 100vw" />
            </div>
          </div>
          <ol className={styles.steps}>
            <li>
              <strong>Weight, before you pay</strong>
              <span>The booking asks each jumper’s weight and checks it against the limit for every activity. If it doesn’t fit, you can’t pay for it.</span>
            </li>
            <li>
              <strong>A medical declaration and indemnity</strong>
              <span>You confirm nobody taking part has a condition that rules them out, and sign the indemnity online, so check-in is quick on the day.</span>
            </li>
            <li>
              <strong>Consent for under-18s</strong>
              <span>Nobody under 12 goes up the tower, and anyone under 18 needs signed consent from a parent or guardian.</span>
            </li>
            <li>
              <strong>Weight again, and the harness</strong>
              <span>
                On site the crew weighs you again so you get the right setup. Your jump master fits the harness and checks every buckle and carabiner.
              </span>
            </li>
            <li>
              <strong>One jumper at a time</strong>
              <span>No tandem jumps, ever. Tandem jumps cause injuries, so the bridge only ever sends one person.</span>
            </li>
            <li>
              <strong>Weather first</strong>
              <span>
                Activities stop when it rains and start again once the crew has re-rigged. Lightning detectors clear the top as soon as their alarm sounds.
              </span>
            </li>
          </ol>
        </div>
      </section>

      <section className={`section ${styles.deep}`} aria-labelledby="limits-title">
        <div className="container">
          <SectionHead
            eyebrow="Limits"
            title="Weight and age, per adventure."
            id="limits-title"
            intro="These limits are fixed for your safety. The crew can’t make exceptions on the day, so check them before you book."
          />
          <div className={`${styles.tableWrap} reveal`}>
            {/* Roles keep the table semantics when phones restyle rows as cards. */}
            <table className={`${styles.table} ${styles.stack}`} role="table">
              <caption className="visually-hidden">Weight and age limits per adventure</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Adventure
                  </th>
                  <th scope="col" role="columnheader">
                    Weight
                  </th>
                  <th scope="col" role="columnheader">
                    Age or experience
                  </th>
                  <th scope="col" role="columnheader">
                    Parent or guardian consent
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {limited.map((a) => (
                  <tr key={a.id} role="row">
                    <th scope="row" role="rowheader">
                      <Link href={`/adventures/${a.id}` as Route}>{a.name}</Link>
                    </th>
                    <td role="cell" data-label="Weight" className={styles.num}>
                      {a.rules.minWeightKg && a.rules.maxWeightKg
                        ? `${a.rules.minWeightKg}–${a.rules.maxWeightKg} kg`
                        : a.id === 'zipline'
                          ? 'Checked on the day'
                          : '—'}
                    </td>
                    <td role="cell" data-label="Age or experience">
                      {a.rules.minAge ? `${a.rules.minAge}+` : (a.facts.find((f) => f.label === 'Experience')?.value ?? 'No minimum')}
                    </td>
                    <td role="cell" data-label="Consent">
                      {a.rules.consentUnder ? `Under ${a.rules.consentUnder}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="medical-title">
        <div className="container">
          <div className="grid grid--3">
            <div className="card card--dark reveal">
              <p className="eyebrow">Medical</p>
              <h2 id="medical-title" className="h3">
                Please don’t take part with
              </h2>
              <ul className={styles.dots}>
                {medicalExclusions.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '80ms' }}>
              <Rain width={30} height={30} />
              <h2 className="h3">Weather holds</h2>
              <p className="muted">
                The crew pauses jumps the moment it starts to rain, and the tower status strip on every page shows a weather hold as it happens. If weather
                stops jumps during your booked slot, you can move it for free.
              </p>
              <Link href="/visit#status" className="link-arrow">
                Today’s status <ArrowUpRight />
              </Link>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '160ms' }}>
              <Scale width={30} height={30} />
              <h2 className="h3">Why weight matters</h2>
              <p className="muted">
                The cord and harness are set for your weight. That’s why we ask before you pay, and check again before you jump. SCAD freefall has a lower limit
                than the bungee.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="crew-title">
        <div className={`container ${styles.split} ${styles.splitCenter}`}>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug="bungee-pov-edge" sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
          <div className={`${styles.splitBody} reveal`}>
            <Users width={30} height={30} />
            <p className="eyebrow">The crew</p>
            <h2 id="crew-title" className="h2">
              Jump masters, not just staff.
            </h2>
            <p className="lede">
              Bungee jump masters, SCAD jump masters, a ground master and operators run every jump, with a site manager responsible for on-site management and
              safety.
            </p>
            <div className="cluster">
              <Link href="/about#crew" className="btn btn--dark">
                Meet the crew
              </Link>
              <Link href="/legal/indemnity" className="btn btn--light">
                <Shield width={18} height={18} /> Read the indemnity
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="sfaq-title">
        <div className="container">
          <SectionHead eyebrow="Questions" title="Safety questions." id="sfaq-title" />
          <FaqList items={safetyFaqs} name="safety-faq" />
        </div>
      </section>

      <CtaBand
        headingId="safety-cta"
        image="bungee-between-towers"
        eyebrow="Safe hands"
        title="Scared? Good."
        text="Everything else is taken care of. All that’s left for you is the step."
      />
    </>
  );
}
