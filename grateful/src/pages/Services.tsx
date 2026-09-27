import { Link } from 'react-router';
import { formatDuration, formatPriceState } from '../../shared/format';
import { ButtonLink } from '../components/ui/Button';
import { FadeIn, ImageReveal } from '../components/ui/ImageReveal';
import { Picture } from '../components/ui/Picture';
import { SectionHeading } from '../components/ui/SectionHeading';
import { pageSeo } from '../data/seo';
import { useServices } from '../lib/useServices';
import { useSeo } from '../lib/useTitle';

/**
 * Long-form services: a magazine spread per service, image and text swapping
 * sides, rather than a grid of identical cards (brief §21, Services).
 */
export default function Services() {
  useSeo(pageSeo['/services']);
  const { services, error, loading } = useServices();

  return (
    <>
      <section className="page-gutter pt-32 pb-20 lg:pt-44 lg:pb-28">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading as="h1" size="xl" eyebrow="(Custom dresses, alterations & bespoke garments)" lines={['From idea —', 'to finished', <span className="editorial-italic">garment.</span>]} />
          <FadeIn className="max-w-sm lg:pb-4">
            <p className="text-lg opacity-80">From custom dresses and evening gowns to fittings and alterations, every commission follows the same considered path, from the first conversation to the final fitting. Choose where you would like to begin.</p>
          </FadeIn>
        </div>
      </section>

      {error && (
        <p role="alert" className="page-gutter pb-24 font-sans opacity-70">
          {error}
        </p>
      )}

      {loading && (
        <div role="status" className="page-gutter space-y-6 pb-24" aria-busy="true" aria-label="Loading services">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-[50vh]" />
          ))}
        </div>
      )}

      {services?.map((s, i) => {
        const flip = i % 2 === 1;
        return (
          <section key={s.id} aria-labelledby={`svc-${s.id}`} className="border-t border-line lg:grid lg:min-h-[85svh] lg:grid-cols-12">
            <ImageReveal className={`relative aspect-[4/5] lg:col-span-5 lg:aspect-auto ${flip ? 'lg:order-2 lg:col-start-8' : ''}`}>
              <Picture image={s.image} sizes="(min-width: 1024px) 42vw, 100vw" className="h-full" />
            </ImageReveal>
            <div className={`page-gutter flex flex-col justify-between gap-12 py-16 lg:col-span-7 lg:py-20 ${flip ? 'lg:order-1' : 'lg:pl-16'}`}>
              <span className="ui-label opacity-50">{String(i + 1).padStart(2, '0')} / {String(services.length).padStart(2, '0')}</span>
              <div>
                <h2 id={`svc-${s.id}`} className="editorial-title text-[2.6rem] break-words sm:text-6xl lg:text-7xl">
                  {s.name}
                </h2>
                <FadeIn className="mt-8 max-w-lg">
                  <p className="text-xl leading-relaxed opacity-85">{s.description}</p>
                </FadeIn>
              </div>
              <div className="flex flex-col gap-8 border-t border-line pt-6 sm:flex-row sm:items-end sm:justify-between">
                <dl className="grid grid-cols-2 gap-8 font-sans text-sm">
                  <div>
                    <dt className="ui-label opacity-50">Duration</dt>
                    <dd className="mt-2 text-base">{formatDuration(s.durationMinutes)}</dd>
                  </div>
                  <div>
                    <dt className="ui-label opacity-50">Investment</dt>
                    <dd className="mt-2 text-base">{formatPriceState(s.priceCents)}</dd>
                  </div>
                </dl>
                <ButtonLink to={`/booking?service=${s.id}`} arrow aria-label={`Book ${s.name}`}>
                  Book Now
                </ButtonLink>
              </div>
            </div>
          </section>
        );
      })}

      <section className="page-gutter border-t border-line py-20">
        <p className="max-w-xl text-lg opacity-70">
          Not sure where to start? A consultation is the best first step — or <Link to="/contact" className="underline underline-offset-4">send us a message</Link> and we will guide you.
        </p>
      </section>
    </>
  );
}
