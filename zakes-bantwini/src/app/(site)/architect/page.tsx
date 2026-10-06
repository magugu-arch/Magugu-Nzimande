import type { CSSProperties } from 'react';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { Parallax } from '@/components/motion/Parallax';
import { ApprovalFlag } from '@/components/ui/ApprovalFlag';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHead } from '@/components/ui/SectionHead';
import { getPillars } from '@/content';
import { pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';
import home from '../home.module.css';

export const metadata = pageMetadata({
  title: 'The Architect',
  description: 'From artist to architect: the institution Zakes Bantwini is building — Festival, Label, Catalogue, Academy and Community.',
  path: '/architect',
  image: 'IMG_6852',
});

const ARC = [
  { role: 'Artist', line: 'The voice and the stage.', media: 'IMG_6856' as const },
  { role: 'Producer', line: 'The ear and the console.', media: 'IMG_6858' as const },
  { role: 'Founder', line: 'The company and the team.', media: 'IMG_6885' as const },
  { role: 'Curator', line: 'The line-up and the room.', media: 'IMG_6861' as const },
  { role: 'Architect', line: 'The institution that outlasts the work.', media: 'IMG_6863' as const },
];

export default async function ArchitectPage() {
  const pillars = await getPillars();

  return (
    <>
      <PageHero
        eyebrow="The Architect"
        title={['The', 'Architect']}
        intro="The next chapter is an institution rather than another round of competition — built with the same discipline as a record."
        media="IMG_6852"
        overlay="left"
        size="tall"
      />

      <section className="section" aria-labelledby="arc-title">
        <div className="container">
          <SectionHead index="01" eyebrow="The arc" id="arc-title" title="Artist to architect" />
          <ol role="list" className={styles.grid3} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {ARC.map((a, i) => (
              <li key={a.role} className={styles.card} data-reveal style={{ '--reveal-delay': i * 90 } as CSSProperties}>
                <ArtImage id={a.media} sizes="(max-width: 600px) 100vw, 20vw" ratio={{ desktop: '3/4', mobile: '4/3' }} />
                <span className="eyebrow eyebrow-accent">0{i + 1}</span>
                <span className={styles.arcRole}>{a.role}</span>
                <span className="muted">{a.line}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={home.architect} aria-labelledby="monument-title">
        <div className={home.architectImage}>
          <Parallax strength={0.14}>
            <ArtImage id="IMG_6863" fill sizes="(max-width: 860px) 100vw, 50vw" />
          </Parallax>
        </div>
        <div className={home.architectCopy}>
          <p className="eyebrow eyebrow-accent">02 &nbsp;The idea</p>
          <h2 id="monument-title" className="statement" data-reveal>
            Build something larger than yourself — <em>and leave the door open</em>.
          </h2>
          <p className="lede">
            Five pillars, one institution. Each is designed to stand on its own and to strengthen the others: the Festival gathers, the Label builds, the Catalogue
            keeps, the Academy teaches and the Community carries it all.
          </p>
          <ArtImage id="IMG_6871" sizes="(max-width: 860px) 100vw, 40vw" ratio={{ desktop: '16/9', mobile: '4/3' }} />
        </div>
      </section>

      <section className="section" aria-labelledby="pillars-title">
        <div className="container">
          <SectionHead index="03" eyebrow="Five pillars" id="pillars-title" title="The institution" />
          <nav aria-label="Pillars" className={styles.chapterNav}>
            {pillars.map((p) => (
              <a key={p.key} href={`#${p.key}`} className={styles.chip}>
                {p.title}
              </a>
            ))}
          </nav>
          {pillars.map((p, i) => (
            <article key={p.key} id={p.key} className={styles.chapter} aria-labelledby={`${p.key}-title`}>
              <span className={styles.chapterNum}>0{i + 1}</span>
              <div className={styles.chapterBody}>
                <p className={styles.kicker}>{p.kicker}</p>
                <h3 id={`${p.key}-title`}>{p.title}</h3>
                <p className="lede">{p.summary}</p>
                <div className="body-copy">
                  {p.body.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                </div>
                <ApprovalFlag approval={p.approval} />
              </div>
              <div className={styles.chapterMedia}>
                <ArtImage id={p.media} sizes="(max-width: 960px) 66vw, 32vw" ratio={{ desktop: '4/5', mobile: '4/5' }} />
                {p.secondaryMedia && <ArtImage id={p.secondaryMedia} sizes="(max-width: 960px) 33vw, 16vw" ratio={{ desktop: '3/4', mobile: '3/4' }} />}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.fullBleed} aria-labelledby="next-title">
        <ArtImage id="IMG_6888" fill sizes="100vw" overlay="full" decorative />
        <div className={`container ${styles.fullBleedInner}`}>
          <p className="eyebrow eyebrow-accent">04 &nbsp;What comes next</p>
          <h2 id="next-title" className="statement" data-reveal>
            The Handover — <em>a beginning, and a continuation</em>.
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <ButtonLink href="/handover">Enter the next chapter</ButtonLink>
            <ButtonLink href="/collaborate" variant="outline">
              Build with us
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
