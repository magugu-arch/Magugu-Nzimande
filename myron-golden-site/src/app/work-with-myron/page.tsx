import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { Photo } from '@/components/media/Photo';
import { ButtonLink } from '@/components/ui/Button';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ArrowRight } from '@/components/ui/icons';
import { getProgram } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Work With Myron',
  description:
    'Free training, books, the Make More Offers Challenge, advanced coaching and speaking — every way to learn from Myron Golden, side by side.',
  path: '/work-with-myron',
});

interface Path {
  id: string;
  step: string;
  title: string;
  forWhom: string;
  what: string;
  image: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  external?: { label: string; href: string; campaign: string };
}

export default function WorkWithMyronPage() {
  const mmoc = getProgram('make-more-offers-challenge');
  const ksc = getProgram('king-solomons-court');
  const vip = getProgram('vip-day-plus');

  const paths: Path[] = [
    {
      id: 'free',
      step: '01',
      title: 'Free learning',
      forWhom: 'Anyone meeting Myron’s teaching for the first time.',
      what: 'Videos, articles and resources on offers, sales, growth and stewardship. No sign-up needed.',
      image: 'MG-27',
      primary: { label: 'Browse the library', href: '/learn' },
      secondary: { label: 'Read insights', href: '/insights' },
    },
    {
      id: 'books',
      step: '02',
      title: 'The books',
      forWhom: 'Self-paced learners who want the thinking in depth.',
      what: 'Myron’s books, each with its official purchase page.',
      image: 'MG-26',
      primary: { label: 'See the books', href: '/books' },
    },
    ...(mmoc
      ? [
          {
            id: 'challenge',
            step: '03',
            title: mmoc.title,
            forWhom: 'Coaches, consultants, authors, speakers and owners shaping an offer.',
            what: mmoc.summary,
            image: mmoc.image,
            primary: { label: 'About the challenge', href: `/programs/${mmoc.slug}` },
            external: { label: mmoc.cta.label, href: mmoc.cta.href, campaign: 'work-with-myron' },
          },
        ]
      : []),
    {
      id: 'coaching',
      step: '04',
      title: 'Advanced coaching',
      forWhom: 'Established business owners ready for close coaching and peer counsel.',
      what:
        [ksc?.title, vip?.title].filter(Boolean).join(' and ') + ' are application-based pathways.',
      image: 'MG-28',
      primary: { label: 'Compare coaching programs', href: '/programs' },
      ...(ksc ? { secondary: { label: ksc.title, href: `/programs/${ksc.slug}` } } : {}),
    },
    {
      id: 'speaking',
      step: '05',
      title: 'Speaking',
      forWhom: 'Event organisers, churches, companies and hosts.',
      what: 'Keynotes, workshops and conversations, in person or virtual.',
      image: 'MG-08',
      primary: { label: 'Speaking and enquiries', href: '/speaking' },
    },
  ];

  return (
    <>
      <PageHero
        image="MG-31"
        eyebrow="Work With Myron"
        title="Find the right next step"
        intro={
          <p>
            Five ways to learn from Myron, from free teaching to close coaching. Start where you are
            — each path leads naturally to the next.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Work With Myron', path: '/work-with-myron' },
        ]}
      />

      <Section labelledBy="paths-title">
        <div className="container-site">
          <h2 id="paths-title" className="sr-only">
            Every path
          </h2>
          <ol className="space-y-6">
            {paths.map((p, i) => (
              <li key={p.id} id={p.id} data-reveal className="scroll-mt-28">
                <article className="grid overflow-hidden rounded-[1.75rem] bg-charcoal ring-1 ring-ivory/10 md:grid-cols-[1fr_1.25fr]">
                  <div
                    className={`relative aspect-[16/10] md:aspect-auto md:min-h-[22rem] ${i % 2 ? 'md:order-2' : ''}`}
                  >
                    <Photo id={p.image} fill alt="" sizes="(min-width: 768px) 45vw, 100vw" />
                  </div>
                  <div className="flex flex-col justify-center p-7 md:p-12">
                    <span className="font-display text-[1.25rem] text-gold">{p.step}</span>
                    <h3 className="mt-3 font-display text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.012em]">
                      {p.title}
                    </h3>
                    <dl className="mt-6 space-y-4">
                      <div>
                        <dt className="type-eyebrow text-ivory/55">Best for</dt>
                        <dd className="mt-1.5 text-ivory/85">{p.forWhom}</dd>
                      </div>
                      <div>
                        <dt className="type-eyebrow text-ivory/55">What it is</dt>
                        <dd className="mt-1.5 text-ivory/85">{p.what}</dd>
                      </div>
                    </dl>
                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                      <ButtonLink href={p.primary.href} arrow>
                        {p.primary.label}
                      </ButtonLink>
                      {p.external ? (
                        <OutboundLink
                          href={p.external.href}
                          campaign={p.external.campaign}
                          event="program_outbound_click"
                          label={p.id}
                          className="text-[0.9rem] font-semibold text-gold-bright hover:text-ivory"
                        >
                          {p.external.label}
                        </OutboundLink>
                      ) : null}
                      {p.secondary ? (
                        <Link
                          href={p.secondary.href}
                          className="group inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-gold-bright hover:text-ivory"
                        >
                          {p.secondary.label}
                          <ArrowRight
                            size={16}
                            className="transition-transform group-hover:translate-x-0.5"
                          />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="ivory" labelledBy="unsure-title">
        <div className="container-site grid items-center gap-10 md:grid-cols-[1.4fr_1fr]">
          <SectionHeading
            id="unsure-title"
            tone="light"
            eyebrow="Still deciding?"
            title="Ask the team"
            intro="Tell us where your business is and what you are hoping for. Someone will point you to the right place — no sales pitch."
          />
          <div className="flex flex-col gap-3 md:items-end">
            <ButtonLink href="/contact?topic=general" variant="ink" size="lg" arrow>
              Send a question
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
