import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { HERO_VIDEO } from '../content';

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // The video is atmosphere, not content: hold it on its first frame for
  // anyone who has asked the system for less motion.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (query.matches) video.pause();
      else void video.play().catch(() => {});
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return (
    <section
      id="home"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 -z-20 h-full w-full object-cover grayscale-[35%]"
        src={HERO_VIDEO}
        poster="/assets/hero-business.jpg"
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        aria-hidden
        tabIndex={-1}
      />
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
