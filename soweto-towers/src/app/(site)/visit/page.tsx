import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/content/content.module.css';
import { TodayCard } from '@/components/content/TodayCard';
import { JsonLd } from '@/components/site/JsonLd';
import { PageHero } from '@/components/site/PageHero';
import { FaqList } from '@/components/ui/FaqList';
import { ArrowUpRight, Check, Clock, Pin, Shield, Ticket, Users } from '@/components/ui/icons';
import { SectionHead } from '@/components/ui/SectionHead';
import { faqs } from '@/content/faq';
import { directions, site, whatsappLink } from '@/content/site';
import { todaySast } from '@/lib/cached-time';
import { rand } from '@/lib/format';
import { weeklyHoursSummary } from '@/lib/hours';
import { attraction, graph } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Plan Your Visit: Hours, Directions & Tips',
  description:
    'Opening hours, today’s sunset, directions and what to bring to Soweto Towers (Orlando Towers), Cnr Sheffield & Chris Hani Roads, Orlando East, Soweto. Open Thursday to Sunday till sunset.',
  path: '/visit',
  image: '/og/visit.jpg',
});

export default async function VisitPage() {
  const today = await todaySast();
  const hours = weeklyHoursSummary();
  const dayFaqs = faqs.filter((f) => f.group === 'On the day' || f.q.includes('book'));

  return (
    <>
      <PageHero
        crumbs={[{ name: 'Plan your visit', path: '/visit' }]}
        image="soweto-street-tour"
        eyebrow="Plan your visit"
        title="Everything before the step."
        lede="When we’re open, how to find us, what to wear and what to bring. The rest is just the step."
        actions={
          <>
            <Link href="/book" className="btn btn--primary btn--lg">
              Book your jump
            </Link>
            <a href={directions.google} className="btn btn--ghost btn--lg" style={{ color: 'var(--on-dark)' }} target="_blank" rel="noopener">
              Directions
            </a>
          </>
        }
      />

      <section className="section" aria-labelledby="hours-title">
        <div className={`container ${styles.split}`}>
          <TodayCard />
          <div className={`card reveal ${styles.splitBody}`}>
            <Clock width={30} height={30} />
            <h2 id="hours-title" className="h3">
              Opening hours
            </h2>
            <table className={styles.table} style={{ minWidth: 0 }}>
              <caption className="visually-hidden">Weekly opening hours</caption>
              <tbody>
                {hours.map((h) => (
                  <tr key={h.label}>
                    <th scope="row">{h.label}</th>
                    <td>{h.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">
              Sunset ranges from around 17:25 in midwinter to around 19:00 in midsummer, so check today’s time above. A part of every hour stays open for
              walk-ins; a booked slot skips the queue.
            </p>
          </div>
        </div>
      </section>

      <section className={`section ${styles.deep}`} aria-labelledby="where-title">
        <div className={`container ${styles.split} ${styles.splitCenter}`}>
          <div className={`${styles.splitBody} reveal`}>
            <Pin width={30} height={30} />
            <p className="eyebrow">Getting here</p>
            <h2 id="where-title" className="h2">
              Find the painted towers.
            </h2>
            <address style={{ fontStyle: 'normal' }} className="lede">
              {site.address.street}
              <br />
              {site.address.suburb}, {site.address.city}, {site.address.metro}
            </address>
            <p className="muted">
              Search “Soweto Towers” in your maps app: the towers are hard to miss once you are in Orlando East. Most visitors arrive by car, ride-hailing app
              or with a tour.
            </p>
            <div className="cluster">
              <a href={directions.google} className="pill pill--outline" target="_blank" rel="noopener">
                Google Maps
              </a>
              <a href={directions.apple} className="pill pill--outline" target="_blank" rel="noopener">
                Apple Maps
              </a>
              <a href={directions.waze} className="pill pill--outline" target="_blank" rel="noopener">
                Waze
              </a>
              <a href={directions.uber} className="pill pill--outline" target="_blank" rel="noopener">
                Uber
              </a>
            </div>
          </div>
          <div className={`${styles.map} reveal`}>
            <iframe
              src={directions.mapEmbed}
              title="Map showing Soweto Towers in Orlando East, Soweto"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="bring-title">
        <div className="container">
          <SectionHead eyebrow="On the day" title="What to bring." id="bring-title" />
          <div className="grid grid--3">
            <div className="card reveal">
              <Shield width={30} height={30} />
              <h3 className="h3">Wear</h3>
              <ul role="list" className={styles.checks}>
                <li>
                  <Check /> Comfortable clothes you can jump in (preferably no skirts)
                </li>
                <li>
                  <Check /> Closed shoes that stay on
                </li>
                <li>
                  <Check /> Sunscreen: the bridge and the platform are exposed
                </li>
              </ul>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '80ms' }}>
              <Ticket width={30} height={30} />
              <h3 className="h3">Pay & tickets</h3>
              <ul role="list" className={styles.checks}>
                <li>
                  <Check /> Entrance is {rand(site.entranceFee)} per person at the gate
                </li>
                <li>
                  <Check /> The site is cash-free: bring a bank card
                </li>
                <li>
                  <Check /> Your ticket QR code, on your phone
                </li>
                <li>
                  <Check /> Arrive about 20 minutes before your slot
                </li>
              </ul>
            </div>
            <div className="card card--dark reveal" style={{ ['--delay' as string]: '160ms' }}>
              <Users width={30} height={30} />
              <h3 className="h3">Leave behind</h3>
              <ul role="list" className={styles.checks}>
                <li>
                  <Check /> GoPros and loose phones: we film your jump for you
                </li>
                <li>
                  <Check /> Outside food, drinks and braais: Chaf-Pozi is on site
                </li>
                <li>
                  <Check /> Alcohol before your jump: nobody goes up under the influence
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="access-title">
        <div className="container">
          <div className="grid grid--2">
            <div className="card reveal">
              <p className="eyebrow">Access</p>
              <h2 id="access-title" className="h3">
                Access needs?
              </h2>
              <p className="muted">
                If someone in your group uses a wheelchair or has other access needs, WhatsApp the crew before you visit. We’ll tell you honestly what is
                possible on the day and plan around it.
              </p>
              <a href={whatsappLink('Hi Soweto Towers! I have a question about access for our visit: ')} className="link-arrow" target="_blank" rel="noopener">
                Ask on WhatsApp <ArrowUpRight />
              </a>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '80ms' }}>
              <p className="eyebrow">Weather</p>
              <h2 className="h3">Rain and lightning</h2>
              <p className="muted">
                We stop all activities when it starts to rain and carry on once it clears. Lightning detectors bring everyone down from the top if a storm comes
                close. If weather stops jumps during your booked slot, you can move it for free.
              </p>
              <Link href="/safety" className="link-arrow">
                Safety at the towers <ArrowUpRight />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="vfaq-title">
        <div className="container">
          <SectionHead eyebrow="Questions" title="Before you come." id="vfaq-title" />
          <FaqList items={dayFaqs} name="visit-faq" />
          <p className={styles.mt}>
            <Link href="/faq" className="link-arrow">
              All questions <ArrowUpRight />
            </Link>
          </p>
        </div>
      </section>

      <JsonLd data={graph(attraction(today))} />
    </>
  );
}
