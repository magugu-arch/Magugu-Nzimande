import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/PageHero';
import { Gallery } from '@/components/media/Gallery';
import { galleryItems } from '@/components/media/gallery-items';
import { Photo } from '@/components/media/Photo';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow, GoldRule, Pill, Section, SectionHeading } from '@/components/ui/Section';
import { bio, pillars } from '@/content/bio';
import { IS_PREVIEW } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About Myron Golden',
  description:
    'Myron Golden is a business growth strategist, author and speaker whose teaching joins offer creation and sales strategy with timeless, Biblical principles.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <PageHero
        variant="split"
        image="MG-04"
        eyebrow="About"
        title={
          <>
            Strategy for the business. <span className="text-gold-bright italic">Principles</span>{' '}
            for the life behind it.
          </>
        }
        intro={<p>{bio.short}</p>}
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ]}
      />

      <Section tone="ivory" labelledBy="story-title">
        <div className="container-site grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <div className="relative aspect-[3/2] overflow-hidden rounded-[1.75rem] lg:aspect-[4/5]">
              <Photo id="MG-05" fill sizes="(min-width: 1024px) 45vw, 100vw" quality={82} />
            </div>
          </div>
          <div data-reveal>
            <Eyebrow tone="light" className="mb-5">
              His story
            </Eyebrow>
            <h2 id="story-title" className="type-display-md">
              A teacher of business, grounded in faith
            </h2>
            <div className="prose-site mt-8 text-ink/85">
              {bio.long.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {IS_PREVIEW ? (
              <p className="mt-8 inline-flex items-center gap-2 text-[0.85rem] text-slate">
                <Pill tone="light">Draft</Pill> Biography drafted from the official About page;
                awaiting approval.
              </p>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/work-with-myron" variant="ink" arrow>
                Ways to work with Myron
              </ButtonLink>
              <ButtonLink href="/press" variant="ghost" className="text-gold-deep hover:text-ink">
                Press and approved bios
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      <Section labelledBy="pillars-title" grain>
        <div className="container-site">
          <SectionHeading
            id="pillars-title"
            eyebrow="What he teaches"
            title="Four pillars"
            intro="The threads that run through the books, the programs and the stage."
          />
          <ol
            className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] bg-ivory/10 ring-1 ring-ivory/10 md:grid-cols-2"
            data-reveal-group
          >
            {pillars.map((p, i) => (
              <li key={p.title} data-reveal className="bg-ink p-8 md:p-10">
                <span className="font-display text-[1.25rem] text-gold">0{i + 1}</span>
                <h3 className="mt-4 font-display text-[2rem] leading-tight font-semibold tracking-[-0.01em]">
                  {p.title}
                </h3>
                <p className="mt-3 max-w-md text-ivory/72">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="charcoal" labelledBy="gallery-title">
        <div className="container-site">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="gallery-title"
              eyebrow="Portraits"
              title="On stage and in the study"
              intro="Select a portrait to view it larger. Swipe or use the arrow keys to move between them."
            />
          </div>
          <Gallery
            className="mt-12"
            items={galleryItems(['MG-03', 'MG-06', 'MG-15', 'MG-23', 'MG-07', 'MG-33', 'MG-30'])}
          />
        </div>
      </Section>

      <section className="bg-ink py-24 md:py-32" aria-labelledby="about-cta">
        <div className="container-site">
          <GoldRule className="mb-16" />
          <div className="mx-auto max-w-2xl text-center" data-reveal>
            <h2 id="about-cta" className="type-display-md">
              Start with the free teaching
            </h2>
            <p className="type-lede mt-4 text-ivory/75">
              The quickest way to understand how Myron thinks is to hear him teach.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 xs:flex-row">
              <ButtonLink href="/learn" arrow>
                Browse free learning
              </ButtonLink>
              <ButtonLink href="/speaking" variant="secondary">
                Invite Myron to speak
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
