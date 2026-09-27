import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { asset } from '../content';

export function Hero() {
  return (
    <section
      id="home"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink"
    >
      {/* A still photograph with a slow, barely-there drift in place of video
          (see .hero-drift in index.css; it holds still for reduced motion). */}
      <picture>
        <source type="image/webp" srcSet={asset('hero-business.webp')} />
        <img
          src={asset('hero-business.jpg')}
          alt=""
          width={800}
          height={450}
          fetchPriority="high"
          decoding="async"
          className="hero-drift absolute inset-0 -z-20 h-full w-full object-cover object-[50%_30%] grayscale-[35%]"
        />
      </picture>
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/35" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/90 via-ink/55 to-ink/10"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-ink via-ink/60 to-transparent"
      />

      <div className="mx-auto flex w-full max-w-page flex-1 flex-col justify-end px-6 pb-14 pt-32 md:px-10 md:pb-20 xl:px-16 xl:pb-24">
        <p className="label mb-8 flex items-center gap-3 text-white/70">
          <span aria-hidden className="h-px w-8 bg-quest" />
          Quest4Best Consulting
        </p>

        <h1
          id="hero-heading"
          className="display max-w-[14ch] text-[clamp(2.9rem,8.2vw,8.25rem)] text-white"
        >
          Better questions.
          <br />
          Better decisions.
          <br />
          Better outcomes<span className="text-quest">.</span>
        </h1>

        <div className="mt-10 flex flex-col gap-10 md:mt-14 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[34rem] text-base leading-relaxed text-white/70 md:text-lg">
            Independent strategic counsel for leaders navigating growth, transformation and the
            decisions that shape what comes next.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#contact"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-ink transition-colors hover:bg-quest hover:text-white"
            >
              Start a Conversation
              <ArrowUpRight
                aria-hidden
                className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </a>
            <a
              href="#perspective"
              className="liquid-glass group inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-sm font-semibold text-white transition-colors hover:text-white/80"
            >
              Explore the Approach
              <ArrowDown
                aria-hidden
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
