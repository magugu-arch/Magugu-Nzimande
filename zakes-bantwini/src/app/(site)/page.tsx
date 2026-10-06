import Link from 'next/link';
import { connection } from 'next/server';
import type { CSSProperties } from 'react';
import { PillarChapters } from '@/components/home/PillarChapters';
import { EventList } from '@/components/live/EventList';
import { ArtImage } from '@/components/media/ArtImage';
import { HeroMotion } from '@/components/motion/HeroMotion';
import { HorizontalRail } from '@/components/motion/HorizontalRail';
import { Parallax } from '@/components/motion/Parallax';
import { RevealText } from '@/components/motion/RevealText';
import { ListenButton } from '@/components/player/ListenButton';
import { albumQueue } from '@/components/player/queue';
import { JsonLd } from '@/components/seo/JsonLd';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHead } from '@/components/ui/SectionHead';
import { Sleeve } from '@/components/ui/Sleeve';
import { getAlbums, getPillars, getSettings, getStories, JOURNAL_CATEGORIES, pick } from '@/content';
import { upcomingPublicEvents } from '@/lib/booking/public-events';
import { personJsonLd, organizationJsonLd } from '@/lib/seo';
import { SITE_LINE } from '@/lib/site';
import styles from './home.module.css';

const ROLES = ['Artist', 'Producer', 'Founder', 'Curator', 'Architect'];

export default async function HomePage() {
  await connection(); // live dates are read per request
  const [albums, pillars, stories, settings, live] = await Promise.all([getAlbums(), getPillars(), getStories(), getSettings(), upcomingPublicEvents(4)]);
  const featuredStories = pick(stories, settings.featured.stories).slice(0, 4);
  const featuredAlbums = pick(albums, settings.featured.albums);
  const [lead, ...rest] = featuredStories;
  const categoryLabel = (key: string) => JOURNAL_CATEGORIES.find((c) => c.key === key)?.label ?? key;

  return (
    <>
      <JsonLd data={[personJsonLd(), organizationJsonLd()]} />

      {/* 01 / HERO */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroMedia}>
          <HeroMotion>
            <ArtImage id="IMG_6853" fill priority sizes="100vw" overlay="left" />
          </HeroMotion>
        </div>
        <div className={`container ${styles.heroInner}`}>
          <p className="eyebrow eyebrow-accent" data-reveal style={{ '--reveal-delay': 200 } as CSSProperties}>
            The Architect
          </p>
          <RevealText as="h1" id="hero-title" lines={['Zakes', 'Bantwini']} className={`display display-xl ${styles.heroTitle}`} delay={100} />
          <p className={`statement ${styles.heroLine}`} data-reveal style={{ '--reveal-delay': 500 } as CSSProperties}>
            {SITE_LINE.split('. ')[0]}. <em>{SITE_LINE.split('. ')[1]}</em>
          </p>
          <div className={styles.heroActions} data-reveal style={{ '--reveal-delay': 650 } as CSSProperties}>
            <ButtonLink href="/book" cursor="Book">
              Book Zakes
            </ButtonLink>
            <ButtonLink href="#sound" variant="outline">
              Enter the world
            </ButtonLink>
          </div>
        </div>
        <a href="#sound" className={styles.scrollCue} aria-label="Scroll to the music">
          <span>Scroll</span>
          <span className={styles.scrollLine} aria-hidden="true" />
        </a>
      </section>

      {/* 02 / SOUND — three gateways */}
      <section id="sound" className="section" aria-labelledby="sound-title">
        <div className="container">
          <SectionHead index="02" eyebrow="Sound" id="sound-title" title="Three ways in" />
          <ul role="list" className={styles.gates}>
            {[
              { href: '/music', label: 'Music', action: 'Listen', media: 'IMG_6848' as const, note: 'The catalogue' },
              { href: '/videos', label: 'Videos', action: 'Watch', media: 'IMG_6851' as const, note: 'Official, live and on set' },
              { href: '/live', label: 'Live', action: 'Open', media: 'IMG_6865' as const, note: 'Dates and bookings' },
            ].map((g, i) => (
              <li key={g.href} data-reveal style={{ '--reveal-delay': i * 120 } as CSSProperties}>
                <Link href={g.href} className={`${styles.gate} zoom-parent`} data-cursor={g.action}>
                  <ArtImage id={g.media} fill hover="zoom" overlay="bottom" sizes="(max-width: 860px) 100vw, 33vw" />
                  <span className={styles.gateText}>
                    <span className={styles.gateIndex}>0{i + 1}</span>
                    <span className={styles.gateLabel}>{g.label}</span>
                    <span className={styles.gateNote}>{g.note}</span>
                    <span className={styles.gateAction}>
                      {g.action} <span aria-hidden="true">→</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 03 / STORY */}
      <section className={`section ${styles.story}`} aria-labelledby="story-title">
        <div className={`container ${styles.storyGrid}`}>
          <div className={styles.storyImage} data-reveal="mask">
            <ArtImage id="IMG_6855" sizes="(max-width: 860px) 100vw, 40vw" />
          </div>
          <div className={styles.storyCopy}>
            <p className="eyebrow">
              <span className="eyebrow-accent">03</span> &nbsp;The Story
            </p>
            <h2 id="story-title" className="statement" data-reveal>
              More than a performer. <em>A builder of rooms</em> — on stage, in the studio and in the culture.
            </h2>
            <div className="body-copy" data-reveal>
              <p>
                Zakes Bantwini is a South African artist, producer, founder and curator. The music came first. What it builds — a festival, a label, a catalogue, an
                academy, a community — is the next chapter.
              </p>
            </div>
            <ButtonLink href="/story" variant="text" arrow>
              Read the story
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* 04 / CATALOGUE */}
      <section className={styles.catalogue} aria-labelledby="catalogue-title">
        <div className={styles.catalogueBackdrop}>
          <Parallax strength={0.1}>
            <ArtImage id="IMG_6868" fill sizes="100vw" overlay="left" decorative />
          </Parallax>
        </div>
        <div className={`container ${styles.catalogueIntro}`}>
          <p className="eyebrow">
            <span className="eyebrow-accent">04</span> &nbsp;Catalogue
          </p>
          <RevealText lines={['The', 'Catalogue']} id="catalogue-title" className="display display-l" />
          <p className="lede" data-reveal>
            A working archive, not a shelf. Every release, with its artwork, credits and the stories behind it.
          </p>
          <ButtonLink href="/music" variant="outline" cursor="Open">
            Enter the catalogue
          </ButtonLink>
        </div>
        <HorizontalRail label="Featured releases">
          {featuredAlbums.map((album) => (
            <article key={album.slug} className={styles.release}>
              <Link href={`/music/${album.slug}`} className="zoom-parent" data-cursor="Open">
                <Sleeve album={album} sizes="(max-width: 860px) 75vw, 28vw" />
              </Link>
              <div className={styles.releaseMeta}>
                <h3>
                  <Link href={`/music/${album.slug}`}>{album.title}</Link>
                </h3>
                <p className="muted">{album.year ?? 'Year to follow'}</p>
                <ListenButton queue={albumQueue(album, settings)} className={styles.listen} label={`Listen to ${album.title}`}>
                  Listen
                </ListenButton>
              </div>
              <ApprovalFlag approval={album.approval} />
            </article>
          ))}
          <div className={styles.needle} aria-hidden="true">
            <ArtImage id="IMG_6849" fill sizes="30vw" decorative />
          </div>
        </HorizontalRail>
      </section>

      {/* 05 / LIVE */}
      <section className="section" aria-labelledby="live-title">
        <div className="container">
          <SectionHead index="05" eyebrow="Live" id="live-title" title="On stage" intro="Public dates as they are announced — and a direct line to book Zakes for your own." />
          <div className={styles.liveGrid}>
            <div>
              <EventList result={live} compact />
              {live.events.length > 0 && (
                <ButtonLink href="/live" variant="text" arrow className={styles.allDates}>
                  All dates
                </ButtonLink>
              )}
            </div>
            <aside className={styles.privateCard} aria-labelledby="private-title">
              <ArtImage id="IMG_6862" fill overlay="bottom" sizes="(max-width: 860px) 100vw, 40vw" />
              <div className={styles.privateCopy}>
                <p className="eyebrow eyebrow-accent">Private · Corporate · Festival</p>
                <h3 id="private-title" className="display display-s">
                  Book Zakes
                </h3>
                <p>Check the date, send your brief, receive a formal quote. A real booking, started in minutes.</p>
                <ButtonLink href="/book" cursor="Book">
                  Start a booking
                </ButtonLink>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* 06 / ARCHITECT */}
      <section className={styles.architect} aria-labelledby="architect-title">
        <div className={styles.architectImage}>
          <Parallax strength={0.14}>
            <ArtImage id="IMG_6863" fill sizes="(max-width: 860px) 100vw, 50vw" />
          </Parallax>
        </div>
        <div className={styles.architectCopy}>
          <p className="eyebrow">
            <span className="eyebrow-accent">06</span> &nbsp;The Architect
          </p>
          <h2 id="architect-title" className="visually-hidden">
            The Architect
          </h2>
          <ol role="list" className={styles.roles} aria-label="From artist to architect">
            {ROLES.map((r, i) => (
              <li key={r} data-reveal style={{ '--reveal-delay': i * 110 } as CSSProperties} className={i === ROLES.length - 1 ? styles.roleFinal : undefined}>
                {r}
              </li>
            ))}
          </ol>
          <p className="lede" data-reveal>
            The next chapter is an institution rather than another round of competition — built with the same discipline as a record.
          </p>
          <div className={styles.architectStrip}>
            <ArtImage id="IMG_6852" sizes="20vw" ratio={{ desktop: '3/4', mobile: '3/4' }} />
            <ArtImage id="IMG_6885" sizes="20vw" ratio={{ desktop: '3/4', mobile: '3/4' }} />
          </div>
          <ButtonLink href="/architect" variant="outline">
            Explore The Architect
          </ButtonLink>
        </div>
      </section>

      {/* 07 / FIVE PILLARS */}
      <section className="section" aria-labelledby="pillars-title">
        <div className="container">
          <SectionHead
            index="07"
            eyebrow="Five pillars"
            id="pillars-title"
            title="What the music builds"
            intro="Festival, Label, Catalogue, Academy, Community — five chapters of one institution."
          />
          <PillarChapters
            pillars={pillars.map((p, i) => ({
              key: p.key,
              number: `0${i + 1}`,
              title: p.title,
              kicker: p.kicker,
              summary: p.summary,
              image: <ArtImage id={p.media} fill sizes="(max-width: 860px) 100vw, 55vw" />,
              flag: <ApprovalFlag approval={p.approval} />,
            }))}
          />
        </div>
      </section>

      <div className={styles.breath} aria-hidden="true">
        <Parallax strength={0.12}>
          <ArtImage id="IMG_6888" fill sizes="100vw" decorative />
        </Parallax>
      </div>

      {/* 08 / HANDOVER */}
      <section className={styles.handover} aria-labelledby="handover-title">
        <ArtImage id="IMG_6854" fill sizes="100vw" overlay="full" decorative />
        <div className={`container ${styles.handoverInner}`}>
          <p className="eyebrow eyebrow-accent">08 &nbsp;The Handover</p>
          <RevealText lines={['Not an ending.', 'A continuation.']} id="handover-title" className={`statement ${styles.handoverTitle}`} />
          <p className="lede" data-reveal>
            Every body of work is eventually entrusted to the people who will carry it. The Handover is the story of building for them.
          </p>
          <ButtonLink href="/handover" variant="outline">
            Enter the next chapter
          </ButtonLink>
        </div>
      </section>

      {/* 09 / STORIES */}
      {lead && (
        <section className="section" aria-labelledby="stories-title">
          <div className="container">
            <SectionHead index="09" eyebrow="Journal" id="stories-title" title="Stories" />
            <div className={styles.stories}>
              <article className={styles.storyLead} data-reveal>
                <Link href={`/journal/${lead.slug}`} className="zoom-parent" data-cursor="Open">
                  <ArtImage id={lead.hero} hover="zoom" sizes="(max-width: 860px) 100vw, 55vw" ratio={{ desktop: '4/3', mobile: '4/5' }} />
                  <p className="eyebrow eyebrow-accent">{categoryLabel(lead.category)}</p>
                  <h3 className="statement">{lead.title}</h3>
                  <p className="muted">{lead.standfirst}</p>
                </Link>
                <ApprovalFlag approval={lead.approval} />
              </article>
              <div className={styles.storyList}>
                {rest.map((s, i) => (
                  <article key={s.slug} className={styles.storyItem} data-reveal style={{ '--reveal-delay': i * 100 } as CSSProperties}>
                    <Link href={`/journal/${s.slug}`} className="zoom-parent" data-cursor="Open">
                      <ArtImage id={s.hero} hover="zoom" sizes="(max-width: 860px) 40vw, 18vw" ratio={{ desktop: '1/1', mobile: '1/1' }} />
                      <span>
                        <span className="eyebrow eyebrow-accent">{categoryLabel(s.category)}</span>
                        <span className={styles.storyItemTitle}>{s.title}</span>
                      </span>
                    </Link>
                  </article>
                ))}
                <ButtonLink href="/journal" variant="text" arrow>
                  The journal
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 10 / FINAL CTA */}
      <section className={styles.doors} aria-labelledby="doors-title">
        <div className="container">
          <h2 id="doors-title" className="visually-hidden">
            Work with Zakes Bantwini
          </h2>
          <ul role="list">
            {[
              { href: '/book', title: 'Book Zakes', body: 'Private, corporate and festival performances.', media: 'IMG_6873' as const, cursor: 'Book' as const },
              { href: '/community', title: 'Join the movement', body: 'First word on music, dates and the institution.', media: 'IMG_6860' as const, cursor: 'Open' as const },
              { href: '/press', title: 'Press / Collaborate', body: 'EPK, photographs, partnerships and projects.', media: 'IMG_6876' as const, cursor: 'Open' as const },
            ].map((d, i) => (
              <li key={d.href}>
                <Link href={d.href} className={styles.door} data-cursor={d.cursor}>
                  <span className={styles.doorIndex}>0{i + 1}</span>
                  <span className={styles.doorTitle}>{d.title}</span>
                  <span className={styles.doorBody}>{d.body}</span>
                  <span className={styles.doorImage} aria-hidden="true">
                    <ArtImage id={d.media} fill sizes="22vw" decorative />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
