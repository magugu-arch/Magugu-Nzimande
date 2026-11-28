import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { CtaBand } from '@/components/content/CtaBand';
import styles from '@/components/content/content.module.css';
import { AdventureCard } from '@/components/site/AdventureCard';
import { PackageCards } from '@/components/site/PackageCards';
import { PageHero } from '@/components/site/PageHero';
import { Camera, Video } from '@/components/ui/icons';
import { SectionHead } from '@/components/ui/SectionHead';
import { activities, addons, lowestJumpPrice, type Activity } from '@/content/catalog';
import { site } from '@/content/site';
import { getLiveCatalog } from '@/lib/data/settings';
import { rand } from '@/lib/format';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Adventures & Prices',
  description: `Seven ways up at Soweto Towers (Orlando Towers): a 100m bungee from ${rand(lowestJumpPrice)}, straightjacket bungee, SCAD freefall, a 700m zipline over the Orlando Dam, paintball, a 360° lift ride and base jumping.`,
  path: '/adventures',
  image: '/og/adventures.jpg',
});

function weightLabel(a: Activity): string {
  if (a.rules.minWeightKg && a.rules.maxWeightKg) return `${a.rules.minWeightKg}–${a.rules.maxWeightKg} kg`;
  if (a.id === 'zipline') return 'Checked on the day';
  return '—';
}

function mediaLabel(a: Activity): string {
  if (a.videoIncluded) return a.addons.includes('photos') ? `Video included · photos ${rand(addons.photos.price)}` : 'Video included';
  const parts = [];
  if (a.addons.includes('video')) parts.push(`Video ${rand(addons.video.price)}`);
  if (a.addons.includes('photos')) parts.push(`Photos ${rand(addons.photos.price)}`);
  return parts.length ? parts.join(' · ') : '—';
}

function priceLabel(a: Activity): string {
  if (a.booking.mode === 'session') return `${rand(a.price)} per player`;
  if (a.booking.mode === 'enquiry') return `${rand(a.price)} by arrangement`;
  return rand(a.price);
}

export default async function AdventuresPage() {
  const catalog = (await getLiveCatalog()).filter((a) => !a.disabled);
  const ordered = activities.map((a) => catalog.find((c) => c.id === a.id)).filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <>
      <PageHero
        crumbs={[{ name: 'Adventures', path: '/adventures' }]}
        image="towers-sunset-panorama"
        focus="30% 50%"
        eyebrow="Adventures"
        title="Seven ways up, one crew."
        lede="Bungee from the bridge, a freefall inside the tower, a zipline over the dam, paintball, the lift ride and base jumping. Every price is on the card."
        actions={
          <>
            <Link href="/book" className="btn btn--primary btn--lg">
              Book your jump
            </Link>
            <a href="#packages" className="btn btn--ghost btn--lg" style={{ color: 'var(--on-dark)' }}>
              See packages
            </a>
          </>
        }
      />

      <section className="section" aria-labelledby="all-title">
        <div className="container">
          <SectionHead
            eyebrow="Pick your drop"
            title="Every adventure at the towers."
            id="all-title"
            intro="Groups of six or more save on bungee and SCAD, and ten or more on the lift ride, applied automatically when you book."
          />
          <div className={styles.adventureGrid}>
            {ordered.map((a, i) => (
              <div key={a.id} className="reveal" style={{ ['--delay' as string]: `${(i % 3) * 70}ms` }}>
                <AdventureCard activity={a} price={a.price} sizes="(min-width: 1040px) 400px, (min-width: 640px) 50vw, 100vw" />
              </div>
            ))}
            <div className={`card card--dark ${styles.gridNote} reveal`} style={{ ['--delay' as string]: '70ms' }}>
              <p className="eyebrow">Groups</p>
              <h3 className="h2">Coming as a group?</h3>
              <p className="muted">Team days, school outings and celebrations, with quotes and invoicing for companies.</p>
              <div className="cluster">
                <Link href="/groups" className="btn btn--primary">
                  Plan a group day
                </Link>
                <Link href="/gift" className="btn btn--ghost" style={{ color: 'var(--on-dark)' }}>
                  Gift a jump
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className="section section--tight" aria-labelledby="pkg-title">
        <div className="container">
          <SectionHead
            eyebrow="Packages"
            title="Make it count."
            id="pkg-title"
            intro="Bundle the jump with the film, or do the bungee and the SCAD freefall in one visit, and save."
          />
          <PackageCards />
        </div>
      </section>

      <section className="section" aria-labelledby="compare-title">
        <div className="container">
          <SectionHead
            eyebrow="One price list"
            title="Compare at a glance."
            id="compare-title"
            intro={`Plus ${rand(site.entranceFee)} entrance per person at the gate. The site is cash-free: card payments only.`}
          />
          <div className={`${styles.tableWrap} reveal`}>
            {/* Roles keep the table semantics when phones restyle rows as cards. */}
            <table className={`${styles.table} ${styles.stack}`} role="table">
              <caption className="visually-hidden">Adventures at Soweto Towers with prices, group rates and limits</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Adventure
                  </th>
                  <th scope="col" role="columnheader">
                    Price
                  </th>
                  <th scope="col" role="columnheader">
                    Groups
                  </th>
                  <th scope="col" role="columnheader">
                    Weight
                  </th>
                  <th scope="col" role="columnheader">
                    Age or experience
                  </th>
                  <th scope="col" role="columnheader">
                    Video & photos
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {ordered.map((a) => (
                  <tr key={a.id} role="row">
                    <th scope="row" role="rowheader">
                      <Link href={`/adventures/${a.id}` as Route}>{a.name}</Link>
                    </th>
                    <td role="cell" data-label="Price" className={styles.num}>
                      {priceLabel(a)}
                    </td>
                    <td role="cell" data-label="Groups">
                      {a.group
                        ? `${rand(a.group.price)} each for ${a.group.min}+`
                        : a.booking.mode === 'session'
                          ? `${a.booking.minGroup}–${a.booking.maxGroup} players`
                          : '—'}
                    </td>
                    <td role="cell" data-label="Weight" className={styles.num}>
                      {weightLabel(a)}
                    </td>
                    <td role="cell" data-label="Age or experience">
                      {a.rules.minAge ? `${a.rules.minAge}+` : (a.facts.find((f) => f.label === 'Experience')?.value ?? 'No minimum')}
                      {a.rules.consentUnder ? <span className="muted small">{` · consent under ${a.rules.consentUnder}`}</span> : null}
                    </td>
                    <td role="cell" data-label="Video & photos">
                      {mediaLabel(a)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="addons-title">
        <div className="container">
          <SectionHead eyebrow="Add-ons" title="Keep the moment." id="addons-title" />
          <div className="grid grid--2">
            <div className="card reveal">
              <Video width={32} height={32} />
              <h3 className="h3">
                {addons.video.name} · {rand(addons.video.price)}
              </h3>
              <p className="muted">{addons.video.blurb} Already included with the SCAD freefall and the straightjacket bungee.</p>
            </div>
            <div className="card card--dark reveal" style={{ ['--delay' as string]: '80ms' }}>
              <Camera width={32} height={32} />
              <h3 className="h3">
                {addons.photos.name} · {rand(addons.photos.price)}
              </h3>
              <p className="muted">{addons.photos.blurb} Every bungee and SCAD jumper also gets a free 10-second Scream Clip on WhatsApp.</p>
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        headingId="adv-cta"
        image="soweto-dusk-panorama"
        eyebrow="#100mClub"
        title="Your slot is waiting."
        text="Choose a time, check your weight and pay online. Your ticket arrives on WhatsApp."
      />
    </>
  );
}
