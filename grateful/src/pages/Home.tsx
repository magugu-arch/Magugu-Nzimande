import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import { NewsletterForm } from '../components/forms/NewsletterForm';
import { Process } from '../components/Process';
import { ServiceList } from '../components/ServiceList';
import { ButtonLink } from '../components/ui/Button';
import { EditorialCard } from '../components/ui/EditorialCard';
import { FadeIn, ImageReveal } from '../components/ui/ImageReveal';
import { MonogramSeal } from '../components/ui/Logo';
import { Picture } from '../components/ui/Picture';
import { SectionHeading } from '../components/ui/SectionHeading';
import { pageSeo } from '../data/seo';
import { site } from '../data/site';
import { work } from '../data/work';
import { useSeo } from '../lib/useTitle';

const ease = [0.22, 1, 0.36, 1] as const;

function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '12%']);

  const lines: { text: string; italic?: boolean }[] = [{ text: 'Be bold.' }, { text: 'Be you.' }, { text: 'Be' }, { text: 'different.', italic: true }];

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative pt-16 lg:grid lg:min-h-[max(100svh,720px)] lg:grid-cols-12 lg:pt-20">
      {/* Portrait: full-bleed on mobile, the left five columns on desktop. */}
      <div className="relative h-[64svh] min-h-[420px] overflow-hidden lg:col-span-5 lg:h-auto">
        <motion.div
          className="absolute inset-0"
          style={{ y: imageY }}
          initial={reduce ? false : { scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.8, ease }}
        >
          <Picture image="burgundyGown" priority sizes="(min-width: 1024px) 42vw, 100vw" className="h-full" focus="50% 18%" />
        </motion.div>
        {/* Difference blending keeps these legible over both the pale backdrop and the dark gown. */}
        <p className="ui-label absolute bottom-5 left-4 mix-blend-difference md:left-8 lg:left-14">(Fashion)</p>
        <p className="ui-label absolute right-4 bottom-5 mix-blend-difference md:right-8 lg:hidden">{site.location}</p>
      </div>

      <div className="page-gutter relative flex flex-col justify-end pt-10 pb-14 lg:col-span-7 lg:pt-10 lg:pb-12 lg:pl-12 xl:pl-16">
        <h1 id="hero-title" className="editorial-title text-[clamp(3.6rem,17vw,5.5rem)] lg:text-[clamp(5.5rem,9.4vw,10.5rem)]">
          <span className="ui-label mb-6 block opacity-60">Fashion designer · Custom dresses · Johannesburg</span>
          {lines.map((l, i) => (
            <span key={l.text} className="-mb-[0.12em] block overflow-hidden pb-[0.18em]">
              <motion.span
                className={`block ${l.italic ? 'editorial-italic' : ''}`}
                initial={reduce ? false : { y: '105%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1.1, delay: 0.25 + i * 0.1, ease }}
              >
                {l.text}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease }}
          className="mt-8 flex flex-col gap-8 lg:mt-12 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-md">
            <p className="font-serif text-xl italic sm:text-2xl">Fashion designed around your identity.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/booking" arrow>
                Book a Consultation
              </ButtonLink>
              <ButtonLink to="/work" variant="secondary">
                Explore the Work
              </ButtonLink>
            </div>
          </div>
          <div className="hidden shrink-0 xl:block">
            <MonogramSeal light className="w-32 text-[15px]" />
          </div>
        </motion.div>

        <div className="mt-12 hidden items-end justify-between gap-10 border-t border-line pt-6 lg:flex">
          <a href="#intro" className="ui-label inline-flex min-h-11 items-center gap-3 opacity-70 hover:opacity-100">
            <ArrowDown aria-hidden className="size-4 motion-safe:animate-bounce" />
            Scroll
          </a>
          <div className="w-full max-w-sm">
            <NewsletterForm compact />
          </div>
        </div>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section id="intro" aria-label="About Grateful" className="page-gutter scroll-mt-20 border-t border-line py-24 lg:py-36">
      <div className="editorial-grid gap-y-10">
        <p className="ui-label col-span-4 opacity-60 md:col-span-2">(Studio) — {site.location}</p>
        <FadeIn className="col-span-4 md:col-span-6 lg:col-span-9 lg:col-start-4">
          <p className="font-serif text-[1.9rem] leading-[1.15] sm:text-4xl lg:text-[3.4rem] lg:leading-[1.08]">
            Grateful is a fashion design studio in {site.location}. We design and make custom dresses, evening gowns and bespoke garments around the people who wear them: <em>cut, fitted and finished</em> for you alone.
          </p>
          <Link to="/about" className="ui-label mt-10 inline-flex min-h-11 items-center gap-2 opacity-70 hover:opacity-100">
            Meet Grateful <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}

function FeaturedWork() {
  const [a, b, c] = work;
  return (
    <section aria-labelledby="work-title" className="page-gutter pb-24 lg:pb-40">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading id="work-title" lines={['Selected —', 'Work']} />
        <FadeIn className="max-w-xs lg:pb-3 lg:text-right">
          <p className="ui-label leading-relaxed opacity-60">Pieces from the studio, each made for one person, one body and one moment.</p>
          <Link to="/work" className="ui-label mt-5 inline-flex min-h-11 items-center gap-2 hover:underline">
            View all work <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </FadeIn>
      </div>

      <div className="editorial-grid mt-16 gap-y-16 lg:mt-24">
        {a && (
          <div className="col-span-4 md:col-span-5 lg:col-span-7">
            <EditorialCard item={a} index={0} aspect="aspect-[4/5]" sizes="(min-width: 1024px) 55vw, (min-width: 768px) 60vw, 100vw" />
          </div>
        )}
        {b && (
          <div className="col-span-4 md:col-span-3 lg:col-span-4 lg:col-start-9 lg:mt-56">
            <EditorialCard item={b} index={1} aspect="aspect-[3/4]" sizes="(min-width: 1024px) 32vw, (min-width: 768px) 38vw, 100vw" />
          </div>
        )}
        {c && (
          <div className="col-span-4 md:col-span-4 md:col-start-3 lg:col-span-4 lg:col-start-3 lg:-mt-16">
            <EditorialCard item={c} index={2} aspect="aspect-[3/4]" sizes="(min-width: 1024px) 32vw, (min-width: 768px) 50vw, 100vw" />
          </div>
        )}
        <FadeIn className="col-span-4 self-end md:col-span-8 lg:col-span-4 lg:col-start-8 lg:pb-24">
          <p className="font-serif text-3xl leading-tight lg:text-4xl">
            Every piece begins with a <em>conversation</em>, and ends with a garment that could only be yours.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

function Philosophy() {
  return (
    <section aria-labelledby="philosophy-title" className="surface-light bg-white text-black">
      <div className="lg:grid lg:grid-cols-12">
        <ImageReveal className="relative aspect-[4/5] lg:col-span-5 lg:aspect-auto lg:min-h-[900px]">
          <Picture image="whiteShirtLook" sizes="(min-width: 1024px) 42vw, 100vw" className="h-full" focus="50% 6%" />
        </ImageReveal>
        <div className="page-gutter flex flex-col justify-between gap-16 py-20 lg:col-span-7 lg:py-28 lg:pl-16">
          <p className="ui-label text-ink-muted">(Philosophy)</p>
          <div>
            <h2 id="philosophy-title" className="editorial-title text-[3.2rem] sm:text-7xl lg:text-[7.5rem]">
              <FadeIn as="span" className="block">
                Your style.
              </FadeIn>
              <FadeIn as="span" delay={0.08} className="block">
                Your story.
              </FadeIn>
              <FadeIn as="span" delay={0.16} className="block">
                Your <span className="editorial-italic">Grateful.</span>
              </FadeIn>
            </h2>
            <FadeIn delay={0.2} className="mt-12 grid gap-8 sm:grid-cols-2">
              <p className="text-lg leading-relaxed">We design around the person, never the trend. Your proportions, your personality and your occasion set the brief for every piece.</p>
              <p className="text-lg leading-relaxed text-ink-muted">
                Individuality is where we start. Craft is how we work. Confidence is what you leave with. Every garment is a collaboration between your vision and the studio’s hands.
              </p>
            </FadeIn>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <ButtonLink to="/about" tone="light" variant="secondary" arrow>
              Meet Grateful
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section aria-labelledby="services-title" className="page-gutter py-24 lg:py-40">
      <div className="mb-16 flex flex-col gap-8 lg:mb-24 lg:flex-row lg:items-end lg:justify-between">
        <FadeIn className="max-w-sm lg:order-1">
          <p className="ui-label leading-relaxed opacity-60">A considered process from first conversation to final fitting.</p>
          <Link to="/services" className="ui-label mt-5 inline-flex min-h-11 items-center gap-2 hover:underline">
            All services <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </FadeIn>
        <div className="lg:order-2">
          <SectionHeading id="services-title" align="right" lines={['From idea —', 'to finished', '— garment.']} />
        </div>
      </div>
      <ServiceList />
      <div className="mt-24 lg:mt-36">
        <p className="ui-label mb-10 opacity-60">(Process)</p>
        <Process />
      </div>
    </section>
  );
}

function BookingCta() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden border-t border-line">
      <div className="editorial-grid page-gutter items-end gap-y-12 py-24 lg:py-36">
        <div className="col-span-4 md:col-span-8 lg:col-span-8">
          <p className="ui-label mb-8 opacity-60">(Booking)</p>
          <h2 id="cta-title" className="editorial-title text-[3.4rem] sm:text-7xl lg:text-[9rem]">
            <FadeIn as="span" className="block">
              Let’s create
            </FadeIn>
            <FadeIn as="span" delay={0.1} className="block">
              <span className="editorial-italic">something.</span>
            </FadeIn>
          </h2>
          <FadeIn delay={0.2} className="mt-10 max-w-md">
            <p className="text-xl">Book a consultation and start your next piece.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/booking" arrow>
                Book a Consultation
              </ButtonLink>
              <ButtonLink to="/contact" variant="secondary">
                Ask a question
              </ButtonLink>
            </div>
          </FadeIn>
        </div>
        <ImageReveal className="col-span-2 col-start-3 aspect-[3/4] md:col-span-3 md:col-start-6 lg:col-span-3 lg:col-start-10">
          <Picture image="greenGown" sizes="(min-width: 1024px) 24vw, 45vw" className="h-full" />
        </ImageReveal>
      </div>
    </section>
  );
}

export default function Home() {
  useSeo(pageSeo['/']);
  return (
    <>
      <Hero />
      <Intro />
      <FeaturedWork />
      <Philosophy />
      <Services />
      <BookingCta />
    </>
  );
}
