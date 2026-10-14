import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ContactForm } from '@/components/forms/ContactForm';
import { PageHero } from '@/components/layout/PageHero';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { Eyebrow, Section } from '@/components/ui/Section';
import { ArrowRight } from '@/components/ui/icons';
import { contactRoutes, official } from '@/content/site';
import { contactCategories } from '@/lib/validation';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description:
    'Customer support, speaking enquiries, partnerships and press — reach the right person on Myron Golden’s team.',
  path: '/contact',
});

const routeLinks: Record<string, { label: string; href: string } | undefined> = {
  support: { label: 'Member login', href: '/login' },
  speaking: { label: 'Speaking enquiry form', href: '/speaking#enquire' },
  press: { label: 'Press kit', href: '/press' },
};

/** Pre-selects the topic from ?topic=…, so links elsewhere land on the right form. */
async function FormWithTopic({ searchParams }: Pick<PageProps<'/contact'>, 'searchParams'>) {
  const { topic } = await searchParams;
  const value =
    typeof topic === 'string' && (contactCategories as readonly string[]).includes(topic)
      ? topic
      : undefined;
  return <ContactForm defaultCategory={value} />;
}

export default function ContactPage(props: PageProps<'/contact'>) {
  return (
    <>
      <PageHero
        variant="plain"
        eyebrow="Contact"
        title="How can the team help?"
        intro={<p>Choose the kind of question below so it reaches the right person first time.</p>}
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ]}
      />

      <Section labelledBy="routes-title" className="!pt-6">
        <div className="container-site">
          <h2 id="routes-title" className="sr-only">
            Who to contact
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-reveal-group>
            {contactRoutes.map((r) => {
              const link = routeLinks[r.id];
              return (
                <li
                  key={r.id}
                  data-reveal
                  className="flex flex-col rounded-[1.25rem] bg-charcoal p-6 ring-1 ring-ivory/10"
                >
                  <h3 className="type-title">{r.title}</h3>
                  <p className="type-small mt-2 flex-1 text-ivory/70">{r.body}</p>
                  {link ? (
                    <Link
                      href={link.href}
                      className="group mt-4 inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-gold-bright hover:text-ivory"
                    >
                      {link.label}
                      <ArrowRight
                        size={16}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      <Section tone="ivory" labelledBy="form-title">
        <div className="container-site grid gap-14 lg:grid-cols-[0.8fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow tone="light" className="mb-5">
              Send a message
            </Eyebrow>
            <h2 id="form-title" className="type-display-md">
              Write to the team
            </h2>
            <p className="mt-4 text-slate">
              For purchases and course access, include your order or account reference so support
              can find it quickly. Never send card details.
            </p>
            <p className="mt-6 text-[0.9rem] text-slate">
              Already a customer?{' '}
              <Link href="/login" className="font-semibold text-ink underline">
                Go to member login
              </Link>
              . Looking for the official site?{' '}
              <OutboundLink
                href={official.home}
                campaign="contact"
                className="font-semibold text-ink underline"
              >
                myrongolden.com
              </OutboundLink>
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-white p-6 ring-1 ring-ink/[0.08] md:p-10">
            <Suspense fallback={<ContactForm />}>
              <FormWithTopic searchParams={props.searchParams} />
            </Suspense>
          </div>
        </div>
      </Section>
    </>
  );
}
