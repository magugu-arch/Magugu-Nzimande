import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaBand } from '@/components/content/CtaBand';
import styles from '@/components/content/content.module.css';
import { PageHero } from '@/components/site/PageHero';
import { Photo } from '@/components/ui/Photo';
import { SectionHead } from '@/components/ui/SectionHead';
import { crew, crewGroups, initials, mentor } from '@/content/crew';
import { site } from '@/content/site';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'About the Towers & the Crew',
  description:
    'The story of the Soweto Towers (Orlando Towers): cooling towers built in 1951 for the Orlando Power Station, now a vertical adventure centre run by a Soweto crew. Meet the team.',
  path: '/about',
  image: '/og/about.jpg',
});

const values = [
  { name: 'Brave', text: 'We celebrate the step. Every first-timer who goes from “never” to “again” is why we do this.' },
  { name: 'Proud', text: 'A landmark that belongs to the township. Soweto is on top, and we tell its story from up here.' },
  { name: 'Playful', text: 'Screams, laughs, Scream Clips and a crew who know how to calm the nerves and lift the mood.' },
  { name: 'Safe hands', text: 'Checked weights, checked harnesses, one jumper at a time. Safety stays our number one priority.' },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        crumbs={[{ name: 'About', path: '/about' }]}
        image="towers-twilight-reflection"
        eyebrow="Our story"
        title="Two towers. One township. Endless views."
        lede={`${site.name} is the vertical adventure centre on the Orlando Towers, the painted cooling towers of the old Orlando Power Station in Orlando East, Soweto.`}
      />

      <section className="section" aria-labelledby="story-title">
        <div className={`container ${styles.split} ${styles.splitCenter}`}>
          <div className={`${styles.splitBody} reveal`}>
            <p className="eyebrow">From power to adventure</p>
            <h2 id="story-title" className="h2">
              Built to cool a power station.
            </h2>
            <p className="lede">
              The Orlando Power Station supplied electricity to Johannesburg from 1942 until it was decommissioned in 1998. Its two cooling towers were built in
              1951, and they are still standing.
            </p>
            <p>
              Today the towers are painted with murals celebrating Soweto, and they carry a new kind of energy: a 100m bungee from the suspension bridge between
              them, a SCAD freefall inside the Western Cooling Tower, a lift up the outside to a 360° view, paintball in the base and a zipline across the
              Orlando Dam.
            </p>
            <p>
              People search for us by two names, Soweto Towers and Orlando Towers. It is the same landmark either way.{' '}
              <Link href="/journal/soweto-towers-or-orlando-towers">Here’s why.</Link>
            </p>
          </div>
          <div className={`frame ${styles.splitMedia} reveal`}>
            <Photo slug="towers-mural-hero" sizes="(min-width: 960px) 46vw, 100vw" />
          </div>
        </div>
      </section>

      <section className={`section ${styles.deep}`} aria-labelledby="new-title">
        <div className="container">
          <SectionHead
            eyebrow="A new chapter"
            title="New directors, same nerve."
            id="new-title"
            intro="Soweto Towers is going through a transformation, led by two directors with more than 15 years each in the adventure sport industry."
          />
          <div className="grid grid--3">
            <div className="card card--dark reveal">
              <p className="eyebrow">Director</p>
              <h3 className="h3">Sizwe Mathebula</h3>
              <p className="muted">Director and Senior Bungee Jump Master. Sizwe leads the team.</p>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '80ms' }}>
              <p className="eyebrow">Director · Site manager</p>
              <h3 className="h3">Lawrence Sithole</h3>
              <p className="muted">Known for his excellence with clients and management, Lawrence is in charge of on-site management and safety.</p>
            </div>
            <div className="card reveal" style={{ ['--delay' as string]: '160ms' }}>
              <p className="eyebrow">Mentor</p>
              <h3 className="h3">{mentor.name}</h3>
              <p className="muted">Mentoring the team and assisting in a consultancy role.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="values-title">
        <div className="container">
          <SectionHead eyebrow="What we stand for" title="Soweto, from the top." id="values-title" />
          <div className="grid grid--4">
            {values.map((v, i) => (
              <div key={v.name} className={`card ${i === 3 ? 'card--dark' : ''} reveal`} style={{ ['--delay' as string]: `${i * 70}ms` }}>
                <p className="eyebrow">0{i + 1}</p>
                <h3 className="h3">{v.name}</h3>
                <p className="muted">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="crew" className="section" aria-labelledby="crew-title" style={{ scrollMarginTop: 'calc(var(--header-h) + 16px)' }}>
        <div className="container">
          <SectionHead
            eyebrow="Meet the crew"
            title="The people on the bridge."
            id="crew-title"
            intro="Jump masters, operators, multimedia and admin: the crew who will look after you on the day."
          />
          {crewGroups.map((g) => {
            const members = crew.filter((m) => m.group === g);
            if (members.length === 0) return null;
            return (
              <div key={g} className={styles.crewGroup}>
                <h3 className={`h4 ${styles.crewGroupTitle}`}>{g}</h3>
                <ul role="list" className={styles.crewGrid}>
                  {members.map((m) => (
                    <li key={m.name} className={`${styles.member} ${g === 'Leadership' ? styles.memberLead : ''}`}>
                      <span className={styles.avatar} aria-hidden>
                        {initials(m.name)}
                      </span>
                      <p>
                        <strong>{m.name}</strong>
                        <span>{m.role}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <CtaBand
        headingId="about-cta"
        image="lift-ride-view"
        eyebrow="Come and see"
        title="See Soweto from the top."
        text="Jump, freefall, zipline or just ride the lift for the view."
        label="Plan your visit"
        href="/visit"
        secondary={
          <Link href="/book" className="btn btn--ghost btn--lg" style={{ color: 'var(--on-dark)' }}>
            Book a jump
          </Link>
        }
      />
    </>
  );
}
