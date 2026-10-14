import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusPill } from '@/components/cards/Cards';
import { PageHero } from '@/components/layout/PageHero';
import { Accordion } from '@/components/ui/Accordion';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { Eyebrow, Section } from '@/components/ui/Section';
import { ArrowRight, CheckIcon } from '@/components/ui/icons';
import { official } from '@/content/site';
import { getProgram, getPrograms, staticParams } from '@/lib/content';
import { IS_PREVIEW } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

/**
 * Detail pages render their content straight into the static HTML, so every
 * reader and crawler gets the whole page without JavaScript (brief §10).
 * Reading the slug outside <Suspense> means a navigation *could* wait on the
 * server, so the segment opts out of instant validation; the cards that link
 * here prefetch the full page, which keeps navigations instant in practice.
 */
export const instant = false;

export function generateStaticParams() {
  return staticParams(getPrograms().map((p) => p.slug));
}

export async function generateMetadata({
  params,
}: PageProps<'/programs/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const program = getProgram(slug);
  if (!program) return { title: 'Program not found' };
  return pageMetadata({
    title: program.title,
    description: program.summary,
    path: `/programs/${program.slug}`,
    noindex: program.status === 'draft',
  });
}

export default async function ProgramPage({ params }: PageProps<'/programs/[slug]'>) {
  const { slug } = await params;
  const program = getProgram(slug);
  if (!program) notFound();

  const facts = [
    { label: 'Format', value: program.format },
    { label: 'Duration', value: program.duration },
    {
      label: 'Investment',
      value: program.priceDisplay ?? 'See current details on the official page',
    },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  const cta = (
    <OutboundLink
      href={program.cta.href}
      campaign={`program-${program.slug}`}
      event="program_outbound_click"
      label={program.slug}
      variant="primary"
      size="lg"
    >
      {program.cta.label}
    </OutboundLink>
  );

  return (
    <>
      <PageHero
        image={program.image}
        eyebrow={program.format ?? 'Program'}
        title={program.title}
        intro={<p>{program.summary}</p>}
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Programs', path: '/programs' },
          { name: program.title, path: `/programs/${program.slug}` },
        ]}
        meta={program.status !== 'active' ? <StatusPill status={program.status} /> : undefined}
        actions={cta}
      />

      {IS_PREVIEW && program.needsConfirmation.length > 0 ? (
        <div className="border-y border-gold/20 bg-[#1d1810]">
          <div className="container-site py-5 text-[0.9rem] text-gold-bright">
            <strong className="font-semibold">Preview — still to confirm:</strong>{' '}
            {program.needsConfirmation.join(' · ')}
          </div>
        </div>
      ) : null}

      <Section tone="ivory" labelledBy="overview-title">
        <div className="container-site grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-20">
          <div>
            <Eyebrow tone="light" className="mb-5">
              Overview
            </Eyebrow>
            <h2 id="overview-title" className="type-display-md">
              {program.subtitle}
            </h2>

            {program.bestFit.length > 0 ? (
              <div className="mt-10" data-reveal>
                <h3 className="type-title">Best for</h3>
                <ul className="mt-4 space-y-3">
                  {program.bestFit.map((b) => (
                    <li key={b} className="flex gap-3 text-ink/85">
                      <CheckIcon size={20} className="mt-0.5 shrink-0 text-gold-deep" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {program.focus.length > 0 ? (
              <div className="mt-10" data-reveal>
                <h3 className="type-title">What it focuses on</h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {program.focus.map((f) => (
                    <li
                      key={f}
                      className="rounded-2xl bg-white p-5 text-ink/85 ring-1 ring-ink/[0.08]"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[0.875rem] text-slate">
                  These are areas of focus, not promised results. Outcomes depend on your situation
                  and your work.
                </p>
              </div>
            ) : null}

            {program.notFor.length > 0 ? (
              <div className="mt-10" data-reveal>
                <h3 className="type-title">Probably not for you if</h3>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-ink/80">
                  {program.notFor.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <div className="overflow-hidden rounded-[1.75rem] bg-ink text-ivory ring-1 ring-ink/10">
              {/* The hero already carries this program's photograph; the card stays typographic. */}
              <p className="px-7 pt-7 font-display text-[1.6rem] leading-tight font-semibold">
                {program.title}
              </p>
              <dl className="divide-y divide-ivory/10 px-7">
                {facts.map((f) => (
                  <div key={f.label} className="flex flex-col gap-1 py-5">
                    <dt className="type-eyebrow text-ivory/55">{f.label}</dt>
                    <dd className="text-ivory/90">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="px-7 pt-2 pb-8">{cta}</div>
            </div>
            <p className="mt-4 px-2 text-[0.85rem] text-slate">
              Enrolment and payment happen on the official platform. Questions first?{' '}
              <Link href="/contact?topic=support" className="underline">
                Contact the team
              </Link>
              .
            </p>
          </aside>
        </div>
      </Section>

      {program.faqs.length > 0 ? (
        <Section tone="ivory" labelledBy="faq-title" className="!pt-0">
          <div className="container-site max-w-4xl">
            <h2 id="faq-title" className="type-display-sm mb-6">
              Questions
            </h2>
            <Accordion items={program.faqs} />
            <p className="mt-6 text-[0.875rem] text-slate">
              Read the{' '}
              <a
                href={official.returnPolicy}
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                official return policy
              </a>{' '}
              before enrolling.
            </p>
          </div>
        </Section>
      ) : null}

      <Section labelledBy="next-title" className="!py-20">
        <div className="container-site flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <h2 id="next-title" className="type-display-sm max-w-xl">
            Not ready yet? Start with the free teaching.
          </h2>
          <Link
            href="/learn"
            className="group inline-flex items-center gap-2 font-semibold text-gold-bright hover:text-ivory"
          >
            Browse free learning
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </Section>
    </>
  );
}
