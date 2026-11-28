import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdventureCard } from '@/components/site/AdventureCard';
import { EventCard } from '@/components/site/EventCard';
import { JsonLd } from '@/components/site/JsonLd';
import { PackageCards } from '@/components/site/PackageCards';
import { ArtDirectedImage } from '@/components/ui/ArtDirectedImage';
import { FaqList } from '@/components/ui/FaqList';
import { ArrowRight, ArrowUpRight, Clock, Gift, Pin, Scale, Shield, Sunset, Users, Video } from '@/components/ui/icons';
import { Photo } from '@/components/ui/Photo';
import { SectionHead } from '@/components/ui/SectionHead';
import { activities, lowestJumpPrice } from '@/content/catalog';
import { homeFaqs } from '@/content/faq';
import { directions, site } from '@/content/site';
import { todaySast } from '@/lib/cached-time';
import { upcomingEvents } from '@/lib/data/events';
import { monthJumpCount, SOCIAL_PROOF_MIN } from '@/lib/data/public-stats';
import { getLiveCatalog } from '@/lib/data/settings';
import { rand } from '@/lib/format';
import { weeklyHoursSummary } from '@/lib/hours';
import { attraction, faqPage, graph, packagesItemList } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';
import styles from './home.module.css';

export const metadata: Metadata = {
  ...pageMeta({
    title: 'Bungee, SCAD Freefall & Zipline in Soweto',
    description:
      'Bungee jump 100m from the bridge between the painted Orlando Towers in Soweto. SCAD freefall, a 700m zipline over the Orlando Dam, paintball and a 360° lift ride. Book a timed slot from R630.',
    path: '/',
    image: '/og/home.jpg',
  }),
  title: { absolute: 'Soweto Towers (Orlando Towers) | Bungee, SCAD Freefall & Zipline in Soweto' },
};

async function LiveProof() {
  const count = await monthJumpCount();
  if (count < SOCIAL_PROOF_MIN) {
    return (
      <>
        <strong className="price">100 m</strong>
        <span>from the bridge between the towers</span>
      </>
    );
  }
  return (
    <>
      <strong className="price num">{count.toLocaleString('en-US')}</strong>
      <span>jumped this month</span>
    </>
  );
}

async function Adventures() {
  const catalog = await getLiveCatalog();
  return (
    <div className={styles.rail} role="list">
      {catalog
        .filter((a) => !a.disabled)
        .map((a) => (
          <div role="listitem" key={a.id} className={styles.railItem}>
            <AdventureCard activity={a} price={a.price} />
          </div>
        ))}
    </div>
  );
}

async function NextEvents() {
  const events = (await upcomingEvents(3)).slice(0, 3);
  if (events.length === 0) return null;
  return (
    <section className="section" aria-labelledby="events-title">
      <div className="container">
        <SectionHead
          eyebrow="What’s on"
          title="Dates for the diary."
          id="events-title"
          intro="Launch weekends, Scream of the Week, heritage days and team days. RSVP or buy tickets in two taps."
        />
        <div className="grid grid--3">
          {events.map((e) => (
            <div key={e.id} className="reveal">
              <EventCard event={e} />
            </div>
          ))}
        </div>
        <p className={styles.moreLink}>
          <Link href="/events" className="link-arrow">
            All events <ArrowUpRight />
          </Link>
        </p>
      </div>
    </section>
  );
}

async function HomeJsonLd() {
  const today = await todaySast();
  return <JsonLd data={graph(attraction(today), packagesItemList(), faqPage(homeFaqs.map((f) => ({ q: f.q, a: f.a }))))} />;
}

export default function HomePage() {
  const hours = weeklyHoursSummary();
  const groupBungee = activities.find((a) => a.id === 'bungee-jump')!.group!;

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className={styles.heroWrap} aria-labelledby="hero-title">
        <div className={`container ${styles.heroContainer}`}>
          <div className={styles.hero}>
            <ArtDirectedImage
              wide="towers-mural-hero"
              tall="bungee-between-towers"
              eager
              className={styles.heroImage}
              alt="A bungee jumper hangs beneath the bridge between the two painted Soweto Towers"
            />
            <span className={`badge badge--dark ${styles.heroBadge}`}>From {rand(lowestJumpPrice)}</span>
            <div className={`glass-dark ${styles.heroPanel}`}>
              <div className={styles.heroText}>
                <p className={`eyebrow ${styles.heroEyebrow}`}>Soweto Towers · Orlando East, Soweto</p>
                <h1 id="hero-title" className="display">
                  Soweto, from the top.
                </h1>
              </div>
              <div className={styles.heroSide}>
                <p className={styles.heroLede}>
                  A 100m bungee from the bridge between the painted towers. The world’s highest SCAD freefall. A 360° view of the city that raised you.
                </p>
                <div className={styles.heroActions}>
                  <Link href="/book" className="btn btn--primary btn--lg">
                    Book your jump
                  </Link>
                  <Link href="/adventures" className={`btn btn--ghost btn--lg ${styles.heroGhost}`}>
                    See all adventures
                  </Link>
                </div>
              </div>
              <ul role="list" className={styles.heroPills}>
                <li className="pill">Timed slots</li>
                <li className="pill">Prices up front</li>
                <li className="pill">WhatsApp tickets</li>
                <li className="pill">Safety checked</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Proof row ---------- */}
      <section className={`container ${styles.proof}`} aria-label="At a glance">
        <div className={`card card--dark ${styles.proofCard}`}>
          <Suspense
            fallback={
              <>
                <strong className="price">100 m</strong>
                <span>from the bridge between the towers</span>
              </>
            }
          >
            <LiveProof />
          </Suspense>
        </div>
        <div className={`card ${styles.proofCard}`}>
          <Clock />
          <span>
            <strong>Thu 12:00, Fri–Sun 10:00</strong> till sunset
          </span>
        </div>
        <div className={`card ${styles.proofCard}`}>
          <Users />
          <span>
            <strong>Groups of {groupBungee.min}+</strong> jump for {rand(groupBungee.price)} each
          </span>
        </div>
        <div className={`card ${styles.proofCard}`}>
          <Video />
          <span>
            <strong>Free Scream Clip</strong> with every jump
          </span>
        </div>
      </section>

      {/* ---------- Adventures ---------- */}
      <section className={`section ${styles.adventuresSection}`} aria-labelledby="adv-title">
        <div className="container">
          <SectionHead
            eyebrow="Seven ways up, one crew"
            title="Pick your drop."
            id="adv-title"
            intro="Every price on the card is the price you pay. Groups of six or more save on bungee and SCAD automatically."
          />
        </div>
        <div className={styles.railWrap}>
          <Suspense fallback={<div className={styles.railFallback} />}>
            <Adventures />
          </Suspense>
        </div>
      </section>

      {/* ---------- Packages ---------- */}
      <section className="section section--tight" aria-labelledby="pkg-title">
        <div className="container">
          <SectionHead
            eyebrow="Packages"
            title="Make it count."
            id="pkg-title"
            intro="Jump + Film is our most-booked choice: the jump, your Scream Clip and the full HD edit to keep."
          />
          <PackageCards />
        </div>
      </section>

      {/* ---------- Fear / safety ---------- */}
      <section className="section" aria-labelledby="safe-title">
        <div className={`container ${styles.split}`}>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug="before-the-drop" sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
          <div className={`${styles.splitBody} reveal`}>
            <p className="eyebrow">Safe hands</p>
            <h2 id="safe-title" className="h2">
              Scared? Good. That’s the point.
            </h2>
            <p className="lede">Fear is the barrier, not the price. So we take the guesswork out of everything else and leave you only the step.</p>
            <ul role="list" className={styles.safeList}>
              <li>
                <Scale />
                <div>
                  <strong>Weight checked twice</strong>
                  <span>Before you pay, and again on the bridge, so your cord and harness are right for you.</span>
                </div>
              </li>
              <li>
                <Shield />
                <div>
                  <strong>Jump masters, not just staff</strong>
                  <span>A crew led by directors with more than 15 years each in adventure sport. One jumper at a time.</span>
                </div>
              </li>
              <li>
                <Sunset />
                <div>
                  <strong>Weather first</strong>
                  <span>We pause in rain, and lightning detectors clear the top. A weather stop moves your slot for free.</span>
                </div>
              </li>
            </ul>
            <Link href="/safety" className="btn btn--dark">
              How we keep you safe <ArrowRight width={18} height={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Scream Clip ---------- */}
      <section className={`section ${styles.clipSection}`} aria-labelledby="clip-title">
        <div className={`container ${styles.clip}`}>
          <div className={`${styles.clipBody} reveal`}>
            <p className="eyebrow">The Scream Clip</p>
            <h2 id="clip-title" className="h2">
              Every jump becomes a story.
            </h2>
            <ol className={styles.steps}>
              <li>
                <span className={styles.stepNum}>01</span>
                <div>
                  <strong>We film every jump</strong>
                  <span>Our multimedia crew films every bungee and SCAD freefall.</span>
                </div>
              </li>
              <li>
                <span className={styles.stepNum}>02</span>
                <div>
                  <strong>A free clip on WhatsApp</strong>
                  <span>A 10-second vertical clip with a #100mClub end card, sent to your phone.</span>
                </div>
              </li>
              <li>
                <span className={styles.stepNum}>03</span>
                <div>
                  <strong>Share it everywhere</strong>
                  <span>Tick the box when you book and your clip can feature in Scream of the Week.</span>
                </div>
              </li>
              <li className={styles.stepDark}>
                <span className={styles.stepNum}>04</span>
                <div>
                  <strong>The full edit is the upgrade</strong>
                  <span>Your whole jump in HD for {rand(170)}, or bundled in Jump + Film.</span>
                </div>
              </li>
            </ol>
            <Link href="/find-my-jump" className="link-arrow">
              Find my jump <ArrowUpRight />
            </Link>
          </div>
          <div className={`frame ${styles.clipMedia} reveal`}>
            <Photo slug="scream-clip-phone" sizes="(min-width: 960px) 40vw, 100vw" />
          </div>
        </div>
      </section>

      {/* ---------- Groups ---------- */}
      <section className="section" aria-labelledby="groups-title">
        <div className="container">
          <SectionHead
            eyebrow="Groups"
            title="Bring the whole crew."
            id="groups-title"
            intro="Thursdays and Fridays are made for groups: corporate teams, schools and tour groups get the towers at their quietest."
          />
          <div className={styles.bento}>
            <Link href="/groups#celebrations" className={`${styles.bentoBig} reveal`}>
              <Photo slug="celebration-crowd" sizes="(min-width: 960px) 50vw, 100vw" />
              <span className={styles.bentoShade} />
              <span className={styles.bentoText}>
                <span className="eyebrow">Celebrations</span>
                <span className="h3">Make the day legendary</span>
                <span>Birthdays, bachelors and matric results. 6+ jumpers save automatically.</span>
              </span>
            </Link>
            <Link href="/groups#teams" className={`${styles.bentoWide} reveal`}>
              <Photo slug="team-day" sizes="(min-width: 960px) 50vw, 100vw" />
              <span className={styles.bentoShade} />
              <span className={styles.bentoText}>
                <span className="eyebrow">Corporate teams</span>
                <span className="h3">A shared memory at 100m</span>
              </span>
            </Link>
            <Link href="/groups#schools" className={`card ${styles.bentoCard} reveal`}>
              <ArrowUpRight className="card-arrow" />
              <span className="eyebrow">Schools & youth</span>
              <span className="h3">Learners 12 and older</span>
              <span className="muted">A lift ride, the view and the story of the towers. Quotes with invoicing.</span>
            </Link>
            <Link href="/groups#travel" className={`card card--dark ${styles.bentoCard} reveal`}>
              <ArrowUpRight className="card-arrow" />
              <span className="eyebrow">Tour operators & hotels</span>
              <span className="h3">Sell Soweto from the top</span>
              <span className="muted">Priority slots, commission and a tracked partner code.</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Gift a Jump ---------- */}
      <section className="section section--tight" aria-labelledby="gift-title">
        <div className="container">
          <div className={styles.gift}>
            <div className={styles.giftMedia}>
              <Photo slug="gift-a-jump" sizes="(min-width: 960px) 46vw, 100vw" />
            </div>
            <div className={`${styles.giftBody} reveal`}>
              <Gift width={32} height={32} />
              <p className="eyebrow">Gift a Jump</p>
              <h2 id="gift-title" className="h2">
                Give someone a story.
              </h2>
              <p className="lede">Vouchers for a jump, a package or any amount, sent by WhatsApp or email on the day you choose. Valid for a year.</p>
              <div className="cluster">
                <Link href="/gift" className="btn btn--primary">
                  Gift a Jump
                </Link>
                <span className="muted small">From {rand(80)} · Delivered instantly</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- From the top ---------- */}
      <section className="section section--tight" aria-labelledby="view-title">
        <div className="container">
          <div className={styles.panorama}>
            <Photo slug="soweto-dusk-panorama" sizes="(min-width: 1320px) 1280px, 100vw" />
            <div className={`glass-dark ${styles.panoramaPanel} reveal`}>
              <p className="eyebrow" style={{ color: 'var(--coral)' }}>
                No jump required
              </p>
              <h2 id="view-title" className="h2">
                See Soweto from the top.
              </h2>
              <p>
                Ride the lift up the outside of the Western Cooling Tower to a 360° view of Soweto and the city. {rand(80)} per person, {rand(70)} for groups of
                ten or more.
              </p>
              <Link href="/adventures/lift-ride" className="btn btn--light">
                Lift Ride & View
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <NextEvents />
      </Suspense>

      {/* ---------- Restaurant ---------- */}
      <section className="section section--tight" aria-labelledby="food-title">
        <div className={`container ${styles.split} ${styles.splitReverse}`}>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug="shisanyama-platter" sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
          <div className={`${styles.splitBody} reveal`}>
            <p className="eyebrow">Chaf-Pozi, on site</p>
            <h2 id="food-title" className="h2">
              Jump, then braai.
            </h2>
            <p className="lede">
              Shisanyama at the foot of the towers: boerewors, braaied chicken, pap and chakalaka, with cold drinks while you watch the next jumper go.
            </p>
            <p className="muted">Add lunch when you book and we’ll hold a table for after your slot.</p>
            <div className="cluster">
              <Link href="/restaurant" className="btn btn--dark">
                Menu & tables
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Plan your visit ---------- */}
      <section className="section" aria-labelledby="plan-title">
        <div className="container">
          <SectionHead eyebrow="Plan your visit" title="Everything before the step." id="plan-title" />
          <div className="grid grid--3">
            <div className="card reveal">
              <Clock />
              <h3 className="h3">Hours</h3>
              <dl className={styles.hours}>
                {hours.map((h) => (
                  <div key={h.label}>
                    <dt>{h.label}</dt>
                    <dd>{h.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="muted small">Close is always sunset. The strip at the top of the page has today’s time.</p>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '80ms' }}>
              <Pin />
              <h3 className="h3">Getting here</h3>
              <p>
                {site.address.street}
                <br />
                {site.address.suburb}, {site.address.city}
              </p>
              <div className="cluster">
                <a href={directions.google} className="pill pill--outline" target="_blank" rel="noopener">
                  Google Maps
                </a>
                <a href={directions.apple} className="pill pill--outline" target="_blank" rel="noopener">
                  Apple Maps
                </a>
                <a href={directions.uber} className="pill pill--outline" target="_blank" rel="noopener">
                  Uber
                </a>
              </div>
            </div>
            <div className="card card--dark reveal" style={{ ['--delay' as string]: '160ms' }}>
              <Shield />
              <h3 className="h3">Bring</h3>
              <ul role="list" className={styles.bring}>
                <li>Closed shoes and clothes you can jump in</li>
                <li>Sunscreen</li>
                <li>A bank card: the site is cash-free</li>
                <li>Your ticket, on your phone</li>
              </ul>
            </div>
          </div>
          <div className={styles.faq}>
            <FaqList items={homeFaqs} name="home-faq" />
            <Link href="/faq" className="link-arrow">
              All questions <ArrowUpRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="section section--tight" aria-labelledby="ready-title">
        <div className="container">
          <div className={styles.ready}>
            <Photo slug="bungee-pov-edge" sizes="(min-width: 1320px) 1280px, 100vw" />
            <div className={styles.readyShade} />
            <div className={styles.readyBody}>
              <p className="eyebrow" style={{ color: 'var(--coral)' }}>
                #100mClub
              </p>
              <h2 id="ready-title" className="display">
                Are you ready?
              </h2>
              <Link href="/book" className="btn btn--primary btn--lg">
                Book your jump
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <HomeJsonLd />
      </Suspense>
    </>
  );
}
