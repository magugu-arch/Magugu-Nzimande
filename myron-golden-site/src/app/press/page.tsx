import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/PageHero';
import { Photo } from '@/components/media/Photo';
import { ButtonLink } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Eyebrow, Pill, Section, SectionHeading } from '@/components/ui/Section';
import { bio } from '@/content/bio';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Press',
  description: 'Approved biographies, speaker introduction and press contact for Myron Golden.',
  path: '/press',
});

export default function PressPage() {
  const longBio = bio.long.join('\n\n');
  return (
    <>
      <PageHero
        variant="split"
        image="MG-30"
        eyebrow="Press and media"
        title="Press kit"
        intro={
          <p>
            Biographies, a speaker introduction and photography requests for interviews, features
            and event programmes.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Press', path: '/press' },
        ]}
        actions={
          <ButtonLink href="/contact?topic=press" size="lg" arrow>
            Contact the press team
          </ButtonLink>
        }
      />

      <Section tone="ivory" labelledBy="bios-title">
        <div className="container-site">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              id="bios-title"
              tone="light"
              eyebrow="Biographies"
              title="Copy-ready bios"
              size="md"
            />
            {!bio.approved ? (
              <Pill tone="light">Awaiting approval — do not publish yet</Pill>
            ) : null}
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {[
              { title: 'Short bio', text: bio.short },
              { title: 'Speaker introduction', text: bio.speakerIntroduction },
            ].map((b) => (
              <article
                key={b.title}
                className="rounded-[1.5rem] bg-white p-7 ring-1 ring-ink/[0.08]"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="type-title">{b.title}</h3>
                  <CopyButton text={b.text} label="Copy" />
                </div>
                <p className="mt-4 leading-relaxed text-ink/80">{b.text}</p>
              </article>
            ))}
            <article className="rounded-[1.5rem] bg-white p-7 ring-1 ring-ink/[0.08] lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <h3 className="type-title">Long bio</h3>
                <CopyButton text={longBio} label="Copy" />
              </div>
              <div className="prose-site mt-4 max-w-3xl text-ink/80">
                {bio.long.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </article>
          </div>
        </div>
      </Section>

      <Section labelledBy="photos-title">
        <div className="container-site grid items-center gap-12 md:grid-cols-[1fr_1.2fr]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] ring-1 ring-ivory/10">
            <Photo id="MG-04" fill sizes="(min-width: 768px) 40vw, 100vw" quality={82} />
          </div>
          <div>
            <Eyebrow className="mb-5">Photography</Eyebrow>
            <h2 id="photos-title" className="type-display-md">
              Approved press photography on request
            </h2>
            <p className="mt-4 max-w-lg text-ivory/72">
              High-resolution, approved portraits are supplied by the team for publication, with
              credit and usage terms. Please do not take images from this website for press use.
            </p>
            <ButtonLink href="/contact?topic=press" variant="secondary" className="mt-8" arrow>
              Request photography
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
