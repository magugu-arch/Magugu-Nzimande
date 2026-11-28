import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CtaBand } from '@/components/content/CtaBand';
import { PageSkeleton } from '@/components/content/PageSkeleton';
import styles from '@/components/content/content.module.css';
import { EnquiryForm } from '@/components/forms/EnquiryForm';
import { AdventureCard } from '@/components/site/AdventureCard';
import { JsonLd } from '@/components/site/JsonLd';
import { PackageCards } from '@/components/site/PackageCards';
import { PageHero } from '@/components/site/PageHero';
import { FaqList } from '@/components/ui/FaqList';
import { Camera, Check, Shield, Users, Video, WhatsAppGlyph } from '@/components/ui/icons';
import { Photo } from '@/components/ui/Photo';
import { SectionHead } from '@/components/ui/SectionHead';
import { activities, addons, getActivity, medicalExclusions, packages, type ActivityId } from '@/content/catalog';
import { faqs } from '@/content/faq';
import { image, type ImageSlug } from '@/content/images';
import { whatsappLink } from '@/content/site';
import { getLiveCatalog } from '@/lib/data/settings';
import { rand } from '@/lib/format';
import { activityProduct, graph } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';
import { weekdayName } from '@/lib/time';

export async function generateStaticParams() {
  return activities.map((a) => ({ slug: a.id }));
}

export async function generateMetadata({ params }: PageProps<'/adventures/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const a = getActivity(slug);
  if (!a) return {};
  return pageMeta({
    title: a.seo.title,
    description: a.seo.description,
    path: `/adventures/${a.id}`,
    image: `/og/${a.id}.jpg`,
    imageAlt: image(a.image).alt,
  });
}

/** A second photo per adventure, so the page doesn't repeat its hero. */
const secondImage: Record<ActivityId, ImageSlug> = {
  'bungee-jump': 'bungee-pov-edge',
  'straightjacket-bungee': 'harness-check',
  'scad-freefall': 'scream-clip-phone',
  zipline: 'towers-twilight-reflection',
  paintball: 'team-day',
  'lift-ride': 'soweto-dusk-panorama',
  'base-jump': 'towers-mural-hero',
};

const jumpFilm = packages.find((p) => p.id === 'jump-film');

/** FAQs worth repeating on each adventure, matched on question text. */
const relatedFaqs: Record<ActivityId, string[]> = {
  'bungee-jump': ['age or weight', 'tandem', 'rains', 'GoPro', 'videos and photos'],
  'straightjacket-bungee': ['difference between the bungee', 'age or weight', 'rains', 'GoPro'],
  'scad-freefall': ['age or weight', 'How many jumps', 'rains', 'videos and photos'],
  zipline: ['rains', 'videos and photos', 'wear and bring', 'move or cancel'],
  paintball: ['Do I need to book', 'move or cancel', 'age or weight', 'wear and bring'],
  'lift-ride': ['age or weight', 'entrance fee', 'get there', 'wear and bring'],
  'base-jump': ['base jumping', 'rains', 'get there'],
};

function dayRange(days: number[]): string {
  const order = [4, 5, 6, 0, 1, 2, 3];
  const sorted = order.filter((d) => days.includes(d));
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return weekdayName(sorted[0]!);
  return `${weekdayName(sorted[0]!)} to ${weekdayName(sorted.at(-1)!)}`;
}

type Params = PageProps<'/adventures/[slug]'>['params'];

/**
 * The slug is URL data, so it is read inside Suspense: navigations get the shared App Shell straight away,
 * and every known adventure is still prerendered in full by generateStaticParams.
 */
export default function AdventurePage({ params }: PageProps<'/adventures/[slug]'>) {
  return (
    <Suspense fallback={<PageSkeleton variant="photo" />}>
      <Adventure params={params} />
    </Suspense>
  );
}

async function Adventure({ params }: { params: Params }) {
  const { slug } = await params;
  const base = getActivity(slug);
  if (!base) notFound();
  const catalog = await getLiveCatalog();
  const a = catalog.find((x) => x.id === base.id) ?? { ...base, disabled: false };
  const bookable = a.booking.mode !== 'enquiry' && !a.disabled;
  const others = catalog.filter((x) => x.id !== a.id && !x.disabled);
  const faqItems = faqs.filter((f) => relatedFaqs[a.id].some((k) => f.q.toLowerCase().includes(k.toLowerCase())));

  const priceNote = a.booking.mode === 'session' ? 'per player, one-hour game' : a.booking.mode === 'enquiry' ? 'per jump, by arrangement' : 'per person';

  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Adventures', path: '/adventures' },
          { name: a.name, path: `/adventures/${a.id}` },
        ]}
        image={a.image}
        eyebrow={a.short}
        title={a.name}
        lede={a.headline}
        notice={
          a.disabled ? (
            <p className={styles.notice} role="status">
              The crew has paused online bookings for {a.name} for now. WhatsApp us and we’ll tell you when it’s back.
            </p>
          ) : null
        }
        actions={
          bookable ? (
            <Link href={`/book?activity=${a.id}` as Route} className="btn btn--primary btn--lg">
              Book {a.name}
            </Link>
          ) : a.booking.mode === 'enquiry' ? (
            <a href="#apply" className="btn btn--primary btn--lg">
              Apply to jump
            </a>
          ) : (
            <a href={whatsappLink(`Hi Soweto Towers! When is ${a.name} back?`)} className="btn btn--light btn--lg" target="_blank" rel="noopener">
              <WhatsAppGlyph size={18} /> Ask the crew
            </a>
          )
        }
        aside={
          <div className={styles.priceBlock}>
            <span className={styles.priceBig}>{rand(a.price)}</span>
            <span className={styles.priceNote}>
              {priceNote}
              {a.group ? ` · ${rand(a.group.price)} each for ${a.group.min}+` : ''}
            </span>
          </div>
        }
      />

      <section className="section section--tight" aria-label={`${a.name} at a glance`}>
        <div className="container">
          <dl className={styles.facts}>
            {a.facts.map((f) => (
              <div key={f.label} className={`${styles.fact} reveal`}>
                <dt className={styles.factLabel}>{f.label}</dt>
                <dd className={styles.factValue}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section" aria-labelledby="about-title">
        <div className={`container ${styles.split} ${styles.splitCenter}`}>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug={secondImage[a.id]} sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
          <div className={`${styles.splitBody} reveal`}>
            <p className="eyebrow">{a.name}</p>
            <h2 id="about-title" className="h2">
              What to expect.
            </h2>
            {a.description.map((p) => (
              <p key={p.slice(0, 24)} className="lede">
                {p}
              </p>
            ))}
            <h3 className="h4">What’s included</h3>
            <ul role="list" className={styles.checks}>
              {a.includes.map((inc) => (
                <li key={inc}>
                  <Check /> {inc}
                </li>
              ))}
            </ul>
            {bookable ? (
              <Link href={`/book?activity=${a.id}` as Route} className="btn btn--dark">
                Choose a time
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className={`section ${styles.deep}`} aria-labelledby="rules-title">
        <div className="container">
          <SectionHead
            eyebrow="Before you book"
            title="Who can take part."
            id="rules-title"
            intro="We check these before you pay, and the crew checks again on site. It keeps everyone safe."
          />
          <div className="grid grid--3">
            <div className="card reveal">
              <Users width={30} height={30} />
              <h3 className="h3">Limits</h3>
              <ul role="list" className={styles.checks}>
                {a.rules.minWeightKg && a.rules.maxWeightKg ? (
                  <li>
                    <Check /> Weight {a.rules.minWeightKg}–{a.rules.maxWeightKg} kg
                  </li>
                ) : null}
                {a.rules.minAge ? (
                  <li>
                    <Check /> {a.rules.minAge} years or older
                  </li>
                ) : null}
                {a.rules.consentUnder ? (
                  <li>
                    <Check /> Under {a.rules.consentUnder}: signed parent or guardian consent
                  </li>
                ) : null}
                {a.booking.mode === 'session' ? (
                  <>
                    <li>
                      <Check /> {a.booking.minGroup} to {a.booking.maxGroup} players per session
                    </li>
                    <li>
                      <Check /> Sessions {dayRange(a.booking.weekdays)}, booked {a.booking.leadHours} hours ahead
                    </li>
                  </>
                ) : null}
                {a.booking.mode === 'enquiry' ? (
                  <li>
                    <Check /> Screened by our base jump co-ordinator
                  </li>
                ) : null}
              </ul>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '80ms' }}>
              <Shield width={30} height={30} />
              <h3 className="h3">Good to know</h3>
              <ul role="list" className={styles.checks}>
                {a.rules.notes.map((n) => (
                  <li key={n}>
                    <Check /> {n}
                  </li>
                ))}
              </ul>
            </div>
            {a.rules.medicalExclusions ? (
              <div className="card card--dark reveal" style={{ ['--delay' as string]: '160ms' }}>
                <p className="eyebrow">Medical</p>
                <h3 className="h3">Please don’t take part with</h3>
                <ul className={styles.dots}>
                  {medicalExclusions.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <Link href="/safety" className="link-arrow" style={{ color: 'var(--on-dark)' }}>
                  How we keep you safe
                </Link>
              </div>
            ) : (
              <div className="card card--dark reveal" style={{ ['--delay' as string]: '160ms' }}>
                <p className="eyebrow">Safety</p>
                <h3 className="h3">Safe hands</h3>
                <p className="muted">Every activity runs with a safety briefing and all the equipment you need. Ask the crew anything before you start.</p>
                <Link href="/safety" className="link-arrow" style={{ color: 'var(--on-dark)' }}>
                  How we keep you safe
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {a.videoIncluded || a.addons.length > 0 ? (
        <section className="section section--tight" aria-labelledby="media-title">
          <div className="container">
            <SectionHead eyebrow="Video & photos" title="Keep the moment." id="media-title" />
            <div className="grid grid--2">
              {a.videoIncluded ? (
                <div className="card card--dark reveal">
                  <Video width={30} height={30} />
                  <h3 className="h3">Video included</h3>
                  <p className="muted">Our multimedia crew films your {a.name.toLowerCase()} and it’s part of the price.</p>
                </div>
              ) : a.addons.includes('video') ? (
                <div className="card card--dark reveal">
                  <Video width={30} height={30} />
                  <h3 className="h3">
                    {addons.video.name} · {rand(addons.video.price)}
                  </h3>
                  <p className="muted">{addons.video.blurb}</p>
                </div>
              ) : null}
              {a.addons.includes('photos') ? (
                <div className="card reveal" style={{ ['--delay' as string]: '80ms' }}>
                  <Camera width={30} height={30} />
                  <h3 className="h3">
                    {addons.photos.name} · {rand(addons.photos.price)}
                  </h3>
                  <p className="muted">{addons.photos.blurb}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {a.id === 'bungee-jump' ? (
        <section className="section section--tight" aria-labelledby="pkg-title">
          <div className="container">
            <SectionHead
              eyebrow="Packages"
              title="Make it count."
              id="pkg-title"
              intro={`Jump + Film is our pick: the jump, your Scream Clip and the full HD edit${jumpFilm?.saving ? `, for ${rand(jumpFilm.saving)} less than adding the video separately` : ''}.`}
            />
            <PackageCards />
          </div>
        </section>
      ) : null}

      {a.booking.mode === 'enquiry' ? (
        <section id="apply" className="section" aria-labelledby="apply-title">
          <div className={`container ${styles.split}`}>
            <div className={`${styles.splitBody} ${styles.sticky}`}>
              <p className="eyebrow">Apply</p>
              <h2 id="apply-title" className="h2">
                Tell us about your jumps.
              </h2>
              <p className="lede">
                Base jumps are only for skydivers with more than 100 freefalls. Send your details and the base jump co-ordinator will be in touch to screen you
                and arrange a date.
              </p>
            </div>
            <div className="card">
              <EnquiryForm
                types={['base_jump']}
                dateHint="The co-ordinator confirms every base jump date with you."
                page={`/adventures/${a.id}`}
                showCompany={false}
                showGroupSize={false}
                messageLabel="Your experience"
                messagePlaceholder="Number of freefalls, licence or rating, and when you would like to jump."
                submitLabel="Send application"
              />
            </div>
          </div>
        </section>
      ) : null}

      {faqItems.length > 0 ? (
        <section className="section section--tight" aria-labelledby="faq-title">
          <div className="container">
            <SectionHead eyebrow="Questions" title="Good to know." id="faq-title" />
            <FaqList items={faqItems} name={`faq-${a.id}`} />
            <p className={styles.mt}>
              <Link href="/faq" className="link-arrow">
                All questions
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <section className="section section--tight" aria-labelledby="more-title">
        <div className="container">
          <SectionHead eyebrow="More ways up" title="Make a day of it." id="more-title" />
        </div>
        <div className={styles.railClip}>
          <div className={styles.rail} role="list">
            {others.map((o) => (
              <div role="listitem" key={o.id}>
                <AdventureCard activity={o} price={o.price} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {bookable ? (
        <CtaBand
          headingId="adv-cta"
          image="towers-mural-hero"
          eyebrow={a.name}
          title={a.id === 'lift-ride' ? 'The view is waiting.' : 'Are you ready?'}
          text={`${rand(a.price)} ${priceNote}. Book a timed slot and your ticket arrives on WhatsApp.`}
          href={`/book?activity=${a.id}`}
          label={`Book ${a.name}`}
        />
      ) : null}

      <JsonLd data={graph(activityProduct(a))} />
    </>
  );
}
