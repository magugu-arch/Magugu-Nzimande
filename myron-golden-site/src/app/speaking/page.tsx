import type { Metadata } from 'next';
import { SpeakingEnquiryForm } from '@/components/forms/SpeakingEnquiryForm';
import { PageHero } from '@/components/layout/PageHero';
import { Gallery } from '@/components/media/Gallery';
import { galleryItems } from '@/components/media/gallery-items';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow, Pill, Section, SectionHeading } from '@/components/ui/Section';
import { IS_PREVIEW } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Speaking',
  description:
    'Invite Myron Golden to keynote, teach a workshop or join a conversation at your conference, church, company or podcast.',
  path: '/speaking',
});

/** Draft topics built from the teaching pillars — to be approved with the team. */
const topics = [
  {
    title: 'Make more offers',
    body: 'How offers are built and presented, and why the offer is where most businesses win or stall.',
  },
  {
    title: 'Selling with integrity',
    body: 'Leading a sales conversation with conviction and care instead of pressure.',
  },
  {
    title: 'Growing a business that serves',
    body: 'Strategy for growth that keeps the customer, and the long term, at the centre.',
  },
  {
    title: 'Faith, purpose and work',
    body: 'What timeless, Biblical principles have to say about business, money and stewardship.',
  },
];

const formats = [
  { title: 'Keynote', body: 'A focused talk for conferences, conventions and company gatherings.' },
  {
    title: 'Workshop or masterclass',
    body: 'Longer, practical teaching where the audience works on their own business.',
  },
  {
    title: 'Fireside and interviews',
    body: 'A guided conversation on stage, on a podcast or on camera.',
  },
  {
    title: 'Virtual sessions',
    body: 'Live online teaching for distributed teams and online events.',
  },
];

const steps = [
  {
    title: 'Send an enquiry',
    body: 'Tell us about the event, the audience and what you hope they will take away.',
  },
  {
    title: 'The team reviews it',
    body: 'They check fit, availability and logistics, and may come back with questions.',
  },
  {
    title: 'Confirmation, in writing',
    body: 'A date is only booked once the team confirms it with you directly.',
  },
];

export default function SpeakingPage() {
  return (
    <>
      <PageHero
        image="MG-08"
        eyebrow="Speaking"
        title="Bring Myron to your stage"
        intro={
          <p>
            Practical teaching on offers, sales and growth, grounded in timeless principles — for
            conferences, churches, companies and podcasts, in person or online.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Speaking', path: '/speaking' },
        ]}
        actions={
          <>
            <ButtonLink href="#enquire" size="lg" arrow>
              Make an enquiry
            </ButtonLink>
            <ButtonLink href="/press" size="lg" variant="secondary">
              Press kit and bios
            </ButtonLink>
          </>
        }
      />

      <Section labelledBy="topics-title" grain>
        <div className="container-site">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading id="topics-title" eyebrow="Topics" title="What Myron speaks on" />
            {IS_PREVIEW ? <Pill tone="demo">Draft topics — awaiting approval</Pill> : null}
          </div>
          <ul className="mt-12 grid gap-5 md:grid-cols-2" data-reveal-group>
            {topics.map((t, i) => (
              <li
                key={t.title}
                data-reveal
                className="rounded-[1.5rem] bg-charcoal p-7 ring-1 ring-ivory/10 md:p-9"
              >
                <span className="font-display text-gold">0{i + 1}</span>
                <h3 className="mt-3 font-display text-[1.875rem] leading-tight font-semibold">
                  {t.title}
                </h3>
                <p className="mt-3 text-ivory/72">{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="charcoal" labelledBy="formats-title">
        <div className="container-site grid gap-14 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
          <div>
            <SectionHeading
              id="formats-title"
              eyebrow="Formats"
              title="Shaped to your event"
              size="md"
            />
            <ul className="mt-10 divide-y divide-ivory/10 border-y border-ivory/10">
              {formats.map((f) => (
                <li key={f.title} className="py-5">
                  <h3 className="type-title">{f.title}</h3>
                  <p className="mt-1.5 text-ivory/70">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <Gallery items={galleryItems(['MG-06', 'MG-07', 'MG-29', 'MG-09', 'MG-32', 'MG-30'])} />
        </div>
      </Section>

      <Section tone="ivory" labelledBy="process-title">
        <div className="container-site">
          <SectionHeading
            id="process-title"
            tone="light"
            eyebrow="How booking works"
            title="Three steps, no surprises"
            size="md"
          />
          <ol className="mt-12 grid gap-5 md:grid-cols-3" data-reveal-group>
            {steps.map((s, i) => (
              <li
                key={s.title}
                data-reveal
                className="rounded-[1.5rem] bg-white p-7 ring-1 ring-ink/[0.08]"
              >
                <span className="grid size-10 place-items-center rounded-full bg-ink font-display text-gold">
                  {i + 1}
                </span>
                <h3 className="type-title mt-5">{s.title}</h3>
                <p className="mt-2 text-slate">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section id="enquire" labelledBy="enquire-title" className="scroll-mt-16">
        <div className="container-site grid gap-14 lg:grid-cols-[0.8fr_1.4fr] lg:gap-20">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <Eyebrow className="mb-5">Enquiry</Eyebrow>
            <h2 id="enquire-title" className="type-display-md">
              Tell us about your event
            </h2>
            <p className="mt-4 text-ivory/72">
              The more the team knows, the faster they can reply. Fields marked optional can be left
              blank.
            </p>
            <p className="mt-6 text-[0.9rem] text-ivory/60">
              Submitting an enquiry does not reserve a date. You will hear back by email.
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-charcoal p-6 ring-1 ring-ivory/10 md:p-10">
            <SpeakingEnquiryForm />
          </div>
        </div>
      </Section>
    </>
  );
}
