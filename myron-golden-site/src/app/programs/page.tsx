import type { Metadata } from 'next';
import { ProgramCard } from '@/components/cards/Cards';
import { PageHero } from '@/components/layout/PageHero';
import { ButtonLink } from '@/components/ui/Button';
import { Section, SectionHeading } from '@/components/ui/Section';
import { getPrograms } from '@/lib/content';
import { IS_PREVIEW } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Programs',
  description:
    'The Make More Offers Challenge, King Solomon’s Court and VIP Day+ — programs for creating offers, selling with integrity and growing a business.',
  path: '/programs',
});

export default function ProgramsPage() {
  const programs = getPrograms();
  const live = programs.filter((p) => p.status !== 'draft');
  const drafts = programs.filter((p) => p.status === 'draft');

  return (
    <>
      <PageHero
        image="MG-28"
        eyebrow="Programs"
        title="Programs for every stage of the work"
        intro={
          <p>
            From a five-day challenge on offers to close, application-based coaching. Each program
            links to its official page, which always has the current dates, details and enrolment.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Programs', path: '/programs' },
        ]}
      />

      <Section labelledBy="current-title">
        <div className="container-site">
          <SectionHeading
            id="current-title"
            eyebrow="Current programs"
            title="Choose your program"
            size="md"
          />
          <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-group>
            {live.map((p, i) => (
              <li key={p.id} data-reveal>
                <ProgramCard program={p} priority={i === 0} />
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {IS_PREVIEW && drafts.length > 0 ? (
        <Section tone="charcoal" labelledBy="drafts-title" className="!py-16">
          <div className="container-site">
            <SectionHeading
              id="drafts-title"
              eyebrow="Preview only"
              title="Awaiting owner confirmation"
              intro="These names appear in the wider program ecosystem. They stay hidden from the public site until the team confirms each one is current and supplies its official destination."
              size="md"
            />
            <ul className="mt-10 grid gap-6 md:grid-cols-2" data-reveal-group>
              {drafts.map((p) => (
                <li key={p.id} data-reveal>
                  <ProgramCard program={p} />
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      <Section tone="ivory" labelledBy="help-title">
        <div className="container-site grid items-center gap-10 md:grid-cols-[1.4fr_1fr]">
          <SectionHeading
            id="help-title"
            tone="light"
            eyebrow="Not sure which?"
            title="Compare every way to work with Myron"
            intro="Free learning, books, the challenge, coaching and speaking — side by side, with who each one suits."
          />
          <div className="md:text-right">
            <ButtonLink href="/work-with-myron" variant="ink" size="lg" arrow>
              Compare paths
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
