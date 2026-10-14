import type { Metadata } from 'next';
import Link from 'next/link';
import { BookCard, ContentCard, EventCard, ProgramCard } from '@/components/cards/Cards';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import { HomeHero } from '@/components/home/HomeHero';
import { Photo } from '@/components/media/Photo';
import { VideoFacade } from '@/components/media/VideoFacade';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow, GoldRule, Pill, Section, SectionHeading } from '@/components/ui/Section';
import { ArrowRight } from '@/components/ui/icons';
import { credentials } from '@/content/bio';
import { getBooks, getContent, getFeaturedPrograms, getTestimonials } from '@/lib/content';
import { site } from '@/content/site';
import { contentHref } from '@/lib/links';
import { getEventBuckets } from '@/lib/events-server';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  description: site.description,
  path: '/',
});

const pathways = [
  {
    n: '01',
    title: 'Learn for free',
    body: 'Start with free teaching on offers, sales and growth.',
    href: '/learn',
    image: 'MG-18',
  },
  {
    n: '02',
    title: 'Read the books',
    body: 'Go deeper at your own pace.',
    href: '/books',
    image: 'MG-17',
  },
  {
    n: '03',
    title: 'Make more offers',
    body: 'A five-day challenge on creating and presenting offers.',
    href: '/programs/make-more-offers-challenge',
    image: 'MG-16',
  },
  {
    n: '04',
    title: 'Go further with coaching',
    body: 'Application-based coaching and mastermind pathways.',
    href: '/work-with-myron#coaching',
    image: 'MG-28',
  },
  {
    n: '05',
    title: 'Book Myron to speak',
    body: 'Keynotes, workshops and conversations for your event.',
    href: '/speaking',
    image: 'MG-07',
  },
];

export default async function HomePage() {
  const programs = getFeaturedPrograms();
  const books = getBooks().filter((b) => b.status === 'active');
  const library = getContent();
  const featuredVideo = library.find((c) => c.type === 'video');
  const moreLearning = library.filter((c) => c.id !== featuredVideo?.id).slice(0, 3);
  const { upcoming } = await getEventBuckets();
  const stories = getTestimonials();

  return (
    <>
      <HomeHero />

      {/* 2 — Credibility: approved facts only, no numbers or rankings. */}
      <section aria-label="About Myron in brief" className="border-y border-ivory/[0.08] bg-ink">
        <ul className="container-site flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-6 text-center xl:justify-between">
          {credentials.map((c, i) => (
            <li
              key={c}
              className="flex items-center gap-8 text-[0.8125rem] font-medium tracking-[0.12em] text-ivory/70 uppercase"
            >
              {i > 0 ? (
                <span aria-hidden="true" className="hidden size-1 rotate-45 bg-gold xl:block" />
              ) : null}
              {c}
            </li>
          ))}
        </ul>
      </section>

      {/* 3 — Start where you are. */}
      <Section id="start" labelledBy="start-title" grain>
        <div className="container-site">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="start-title"
              eyebrow="Start where you are"
              title="Five ways in. One next step."
              intro="Wherever your business is today, there is a sensible place to begin."
            />
            <ButtonLink href="/work-with-myron" variant="ghost" className="shrink-0">
              Compare every path
            </ButtonLink>
          </div>
        </div>
        {/* A native scroll-snap rail on small screens (the platform's own physics); a row of five on desktop. */}
        <ol className="rail mt-12 auto-cols-[min(17rem,74vw)] pb-2 xl:mx-auto xl:max-w-[80rem] xl:grid-flow-row xl:grid-cols-5 xl:overflow-visible">
          {pathways.map((p) => (
            <li key={p.n} data-reveal>
              <Link
                href={p.href}
                className="lift group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[1.5rem] bg-charcoal p-5 ring-1 ring-ivory/10 hover:ring-gold/40"
              >
                <Photo
                  id={p.image}
                  fill
                  alt=""
                  sizes="(min-width: 1280px) 18vw, 17rem"
                  className="lift-image"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/5" />
                <span className="relative font-display text-[1rem] text-gold">{p.n}</span>
                <span className="relative mt-2 font-display text-[1.6rem] leading-[1.08] font-semibold tracking-[-0.01em]">
                  {p.title}
                </span>
                <span className="type-small relative mt-2 text-ivory/75">{p.body}</span>
                <ArrowRight
                  size={20}
                  className="relative mt-4 text-gold-bright transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      {/* 4 — Featured programs. */}
      <Section tone="charcoal" labelledBy="programs-title">
        <div className="container-site">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="programs-title"
              eyebrow="Programs"
              title="Structured ways to build what you sell"
              intro="Current dates, prices and enrolment always live on each program’s official page."
            />
            <ButtonLink href="/programs" variant="ghost" className="shrink-0">
              All programs
            </ButtonLink>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-group>
            {programs.map((p) => (
              <li key={p.id} data-reveal>
                <ProgramCard program={p} />
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 5 — Books. */}
      <Section tone="ivory" labelledBy="books-title">
        <div className="container-site grid gap-14 lg:grid-cols-[0.9fr_2fr] lg:gap-20">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <SectionHeading
              id="books-title"
              tone="light"
              eyebrow="Books"
              title="Read the thinking behind the teaching"
              intro="Each book links to its official purchase page."
            />
            <ButtonLink href="/books" variant="ink" className="mt-8" arrow>
              All books
            </ButtonLink>
          </div>
          <ul className="grid gap-12 sm:grid-cols-2" data-reveal-group>
            {books.map((b) => (
              <li key={b.id} data-reveal>
                <BookCard book={b} />
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 6 — Free learning. */}
      <Section labelledBy="learn-title" grain>
        <div className="container-site">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              id="learn-title"
              eyebrow="Free learning"
              title="Teaching you can use this week"
              intro="Videos, articles and resources on offers, sales, growth and stewardship."
            />
            <ButtonLink href="/learn" variant="ghost" className="shrink-0">
              Browse the library
            </ButtonLink>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            {featuredVideo ? (
              <div data-reveal>
                <VideoFacade
                  youtubeId={featuredVideo.youtubeId}
                  title={featuredVideo.title}
                  poster={
                    <Photo
                      id={featuredVideo.image}
                      fill
                      alt=""
                      sizes="(min-width: 1024px) 60vw, 100vw"
                    />
                  }
                />
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Pill tone="muted">Featured video</Pill>
                  {featuredVideo.isDemo ? <Pill tone="demo">Demo</Pill> : null}
                </div>
                <h3 className="mt-3 font-display text-[2rem] leading-tight font-semibold">
                  <Link href={contentHref(featuredVideo)} className="hover:text-gold-bright">
                    {featuredVideo.title}
                  </Link>
                </h3>
                <p className="mt-2 max-w-xl text-ivory/72">{featuredVideo.excerpt}</p>
              </div>
            ) : null}
            <ul className="grid content-start gap-6" data-reveal-group>
              {moreLearning.map((item) => (
                <li key={item.id} data-reveal>
                  <ContentCard item={item} layout="row" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 7 — Upcoming events: only what has not ended; an honest empty state otherwise. */}
      <Section tone="midnight" labelledBy="events-title">
        <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <div>
            <SectionHeading
              id="events-title"
              eyebrow="Events"
              title="Learn in the room"
              intro="Live teaching, workshops and conversations. Dates are confirmed with the team before they appear here."
            />
            <ButtonLink href="/events" variant="secondary" className="mt-8" arrow>
              View all events
            </ButtonLink>
          </div>
          {upcoming.length > 0 ? (
            <ul className="space-y-4" data-reveal-group>
              {upcoming.slice(0, 3).map((e) => (
                <li key={e.id} data-reveal>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-[1.5rem] bg-ink/50 p-8 ring-1 ring-ivory/10">
              <p className="font-display text-[1.75rem] font-semibold">
                No public events are scheduled right now
              </p>
              <p className="mt-2 text-ivory/72">New dates go to the mailing list first.</p>
            </div>
          )}
        </div>
      </Section>

      {/* 8 — Client stories: only with written permission. Placeholders exist in preview alone. */}
      {stories.length > 0 ? (
        <Section tone="charcoal" labelledBy="stories-title">
          <div className="container-site">
            <SectionHeading
              id="stories-title"
              eyebrow="Client stories"
              title="In their own words"
              intro="Stories appear here only with the client’s written permission, in their own words and with their context."
            />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
              {stories.map((s, i) =>
                s.approved && s.quote ? (
                  <li key={s.id} data-reveal>
                    <figure className="h-full rounded-[1.5rem] bg-ink/60 p-6 ring-1 ring-ivory/10">
                      <blockquote className="font-display text-[1.375rem] leading-snug">
                        “{s.quote}”
                      </blockquote>
                      <figcaption className="type-small mt-5 text-ivory/70">
                        {s.name}
                        {s.role ? `, ${s.role}` : ''}
                      </figcaption>
                    </figure>
                  </li>
                ) : (
                  <li key={s.id} data-reveal>
                    <div className="flex h-full min-h-48 flex-col justify-between rounded-[1.5rem] border border-dashed border-ivory/20 p-6">
                      <span
                        aria-hidden="true"
                        className="font-display text-[3.5rem] leading-none text-gold/40"
                      >
                        “
                      </span>
                      <div>
                        <Pill tone="demo">Placeholder {i + 1}</Pill>
                        <p className="type-small mt-3 text-ivory/65">
                          Awaiting an approved client story.
                        </p>
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </div>
        </Section>
      ) : null}

      {/* 9 — Newsletter, then the closing call to action. */}
      <section
        id="newsletter"
        aria-labelledby="newsletter-title"
        className="relative isolate overflow-hidden bg-ink py-24 md:py-32"
      >
        <div className="absolute inset-0 -z-10">
          <Photo id="MG-35" fill sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/35 to-ink" />
        </div>
        <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <div data-reveal>
            <Eyebrow className="mb-5">The mailing list</Eyebrow>
            <h2 id="newsletter-title" className="type-display-lg">
              New teaching, <span className="text-gold-bright italic">in your inbox</span>
            </h2>
            <p className="type-lede mt-5 max-w-md text-ivory/75">
              Free training, new resources and event dates — sent when there is something worth
              sending. Unsubscribe whenever you like.
            </p>
          </div>
          <div
            data-reveal
            className="material rounded-[1.75rem] bg-charcoal/70 p-6 ring-1 ring-ivory/10 backdrop-blur-xl md:p-9"
          >
            <NewsletterForm sourcePage="/" />
          </div>
        </div>
      </section>

      <section aria-labelledby="final-title" className="bg-ink pb-24 md:pb-32">
        <div className="container-site">
          <GoldRule className="mb-20" />
          <div className="mx-auto max-w-3xl text-center" data-reveal>
            <h2 id="final-title" className="type-display-lg">
              Not sure where to begin?
            </h2>
            <p className="type-lede mx-auto mt-5 max-w-xl text-ivory/75">
              Compare every way of working with Myron side by side, or send the team a question.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 xs:flex-row">
              <ButtonLink href="/work-with-myron" size="lg" arrow>
                Find your path
              </ButtonLink>
              <ButtonLink href="/contact" size="lg" variant="secondary">
                Ask a question
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
