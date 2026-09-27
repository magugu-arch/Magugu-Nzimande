import { Process } from '../components/Process';
import { ButtonLink } from '../components/ui/Button';
import { FadeIn, ImageReveal } from '../components/ui/ImageReveal';
import { Logo } from '../components/ui/Logo';
import { Picture } from '../components/ui/Picture';
import { SectionHeading } from '../components/ui/SectionHeading';
import { site } from '../data/site';
import { useTitle } from '../lib/useTitle';

/** The tools of the trade, from the CI's image library page. Named, not illustrated, until approved photography exists. */
const craft = ['Scissors', 'Tape measure', 'Pattern pieces', 'Cutting fabric', 'Sewing machine', 'Mannequin', 'Technical drawings', 'Needles & tools'];

export default function About() {
  useTitle('About');
  return (
    <>
      <section className="lg:grid lg:min-h-svh lg:grid-cols-12 lg:pt-20">
        <div className="page-gutter flex flex-col justify-end pt-32 pb-16 lg:col-span-7 lg:pt-24 lg:pb-20">
          <SectionHeading as="h1" size="xl" eyebrow="(About)" lines={['Meet —', <span className="editorial-italic">Grateful.</span>]} />
          <FadeIn delay={0.2} className="mt-12 max-w-xl">
            <p className="font-serif text-2xl leading-snug">
              Grateful is the fashion design studio of <strong className="font-semibold">{site.designer}</strong>, based in {site.location}.
            </p>
          </FadeIn>
        </div>
        <ImageReveal className="relative h-[80svh] lg:col-span-5 lg:h-auto">
          <Picture image="whiteGarment" priority sizes="(min-width: 1024px) 42vw, 100vw" className="h-full" focus="50% 25%" />
        </ImageReveal>
      </section>

      <section aria-labelledby="story-title" className="page-gutter border-t border-line py-24 lg:py-36">
        <div className="editorial-grid gap-y-12">
          <p className="ui-label col-span-4 opacity-60 md:col-span-2">(The story)</p>
          <div className="col-span-4 md:col-span-6 lg:col-span-8 lg:col-start-4">
            <h2 id="story-title" className="editorial-title text-5xl lg:text-7xl">
              Made for one
              <br />
              <span className="editorial-italic">person at a time.</span>
            </h2>
            <FadeIn className="mt-12 grid gap-8 text-lg leading-relaxed md:grid-cols-2">
              <p>Grateful is built on a simple belief: clothing should be shaped around the person wearing it, not the other way around. Every commission starts with who you are, where you are going and how you want to feel when you arrive.</p>
              <p className="opacity-70">From there it is craft — pattern, cut, construction and fitting — carried out with care and patience until the garment is unmistakably yours. Be bold. Be you. Be different.</p>
            </FadeIn>
          </div>
        </div>
      </section>

      <section aria-labelledby="philosophy-title" className="surface-light bg-white text-black">
        <div className="lg:grid lg:grid-cols-12">
          <div className="page-gutter py-24 lg:col-span-7 lg:py-36">
            <p className="ui-label text-ink-muted">(Philosophy)</p>
            <h2 id="philosophy-title" className="editorial-title mt-10 text-5xl sm:text-6xl lg:text-8xl">
              Individuality.
              <br />
              <span className="editorial-italic">Craft.</span>
              <br />
              Confidence.
            </h2>
            <dl className="mt-16 grid gap-10 sm:grid-cols-3">
              {[
                ['Individuality', 'Your proportions, your personality, your occasion — never a template.'],
                ['Craft', 'Honest construction and close attention to fit, fabric and finish.'],
                ['Collaboration', 'You bring the vision; we bring the hands. The piece belongs to both.'],
              ].map(([t, d]) => (
                <div key={t} className="border-t border-ink-line pt-5">
                  <dt className="font-serif text-2xl italic">{t}</dt>
                  <dd className="mt-3 text-ink-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ImageReveal className="relative aspect-[4/5] lg:col-span-5 lg:aspect-auto">
            <Picture image="burgundyDetail" mono sizes="(min-width: 1024px) 42vw, 100vw" className="h-full" focus="50% 18%" />
          </ImageReveal>
        </div>
      </section>

      <section aria-labelledby="process-title" className="page-gutter py-24 lg:py-36">
        <SectionHeading id="process-title" eyebrow="(Process)" lines={['Discover —', 'to deliver']} className="mb-16 lg:mb-24" />
        <Process />
      </section>

      <section aria-labelledby="craft-title" className="page-gutter border-t border-line py-24 lg:py-32">
        <div className="editorial-grid gap-y-10">
          <h2 id="craft-title" className="ui-label col-span-4 opacity-60 md:col-span-2">
            (The workroom)
          </h2>
          <ul className="col-span-4 flex flex-wrap gap-x-6 gap-y-2 md:col-span-6 lg:col-span-9 lg:col-start-4">
            {craft.map((c, i) => (
              <li key={c} className="font-serif text-4xl leading-tight lg:text-6xl">
                {i % 2 ? <em>{c}</em> : c}
                {i < craft.length - 1 && <span className="opacity-30"> /</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page-gutter border-t border-line py-24 text-center lg:py-32">
        <Logo variant="monogram" className="mx-auto h-16" />
        <p className="editorial-title mx-auto mt-10 max-w-3xl text-4xl lg:text-6xl">Your style. Your story. Your Grateful.</p>
        <div className="mt-10 flex justify-center">
          <ButtonLink to="/booking" arrow>
            Book a Consultation
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
