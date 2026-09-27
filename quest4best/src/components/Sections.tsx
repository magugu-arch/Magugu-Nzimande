import { ArrowUpRight } from 'lucide-react';
import { BRAND_LINE, CONTACT_EMAIL, NAV_LINKS, asset } from '../content';
import { Logo } from './Logo';

const container = 'mx-auto w-full max-w-page px-6 md:px-10 xl:px-16';

type SectionLabelProps = { index: string; children: string; onLight?: boolean };

// Orange on the off-white background is only 3.2:1, too low for small text,
// so on light sections the orange moves to the rule and the words go to ink.
function SectionLabel({ index, children, onLight = false }: SectionLabelProps) {
  return (
    <p className={`label flex items-center gap-3 ${onLight ? 'text-ink' : 'text-quest'}`}>
      <span>{index}</span>
      <span aria-hidden className="h-px w-6 bg-quest" />
      <span>{children}</span>
    </p>
  );
}

type PhotoProps = {
  /** Base name in public/assets; expects `<name>.jpg`, `<name>.webp` and, when wide, `<name>-640.webp`. */
  name: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  imgClassName?: string;
};

function Photo({ name, alt, width, height, sizes, className = '', imgClassName = '' }: PhotoProps) {
  const srcSet =
    width > 700
      ? `${asset(`${name}-640.webp`)} 640w, ${asset(`${name}.webp`)} ${width}w`
      : `${asset(`${name}.webp`)} ${width}w`;
  return (
    <picture className={`block overflow-hidden bg-soft ${className}`}>
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      <img
        src={asset(`${name}.jpg`)}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${imgClassName}`}
      />
    </picture>
  );
}

const PRINCIPLES = ['Listen deeply', 'Challenge clearly', 'Act decisively'];

export function Quest() {
  return (
    <section
      id="perspective"
      aria-labelledby="quest-heading"
      className="bg-ink py-24 md:py-36 xl:py-44"
    >
      <div className={container}>
        <SectionLabel index="01">The Quest</SectionLabel>

        <div className="mt-10 grid gap-16 lg:mt-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <h2
              id="quest-heading"
              className="display max-w-[12ch] text-[clamp(2.6rem,6.4vw,6.5rem)] text-white"
            >
              Clarity before complexity.
            </h2>
            <p className="mt-10 max-w-[36rem] text-lg leading-relaxed text-white/70 md:text-xl md:leading-relaxed">
              The best advice does not add noise. It creates a clearer view of the real problem, the
              real opportunity and the few moves that matter most.
            </p>

            <ol className="mt-16 border-t border-white/10 md:mt-24">
              {PRINCIPLES.map((principle, i) => (
                <li
                  key={principle}
                  className="flex items-baseline gap-6 border-b border-white/10 py-7 md:gap-10 md:py-9"
                >
                  <span className="label w-8 shrink-0 text-white/50">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-2xl font-medium tracking-tight text-white md:text-4xl">
                    {principle}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <Photo
            name="mlungisi-meeting"
            sizes="(min-width: 1024px) 34vw, 100vw"
            alt="Mlungisi Mathonsi listening at a meeting table with two colleagues, rain on the window behind them."
            width={1023}
            height={1537}
            className="aspect-[4/5] lg:col-span-4 lg:col-start-9 lg:aspect-auto lg:h-full"
            imgClassName="grayscale"
          />
        </div>
      </div>
    </section>
  );
}

const SERVICES = [
  {
    title: 'Strategic Growth',
    body: 'Turn ambition into a focused growth agenda, with the commercial priorities, operating choices and execution discipline to move the business forward.',
  },
  {
    title: 'Transformation',
    body: 'Navigate complex change with clarity — aligning people, operating models, customer experience and performance around a practical destination.',
  },
  {
    title: 'Leadership Advisory',
    body: 'A trusted senior perspective for decisions that matter: challenge assumptions, sharpen the choice and build confidence to act.',
  },
];

export function Expertise() {
  return (
    <section
      id="expertise"
      aria-labelledby="expertise-heading"
      className="bg-paper py-24 text-ink md:py-36 xl:py-44"
    >
      <div className={container}>
        <SectionLabel index="02" onLight>
          Expertise
        </SectionLabel>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12">
          <h2
            id="expertise-heading"
            className="display max-w-[16ch] text-[clamp(2.4rem,5.4vw,5.5rem)] lg:col-span-8"
          >
            Senior thinking for consequential moments.
          </h2>
          <p className="max-w-[26rem] text-lg leading-relaxed text-black/60 lg:col-span-4 lg:self-end">
            Built for leaders who need an experienced outside perspective, without the theatre of
            traditional consulting.
          </p>
        </div>

        <ol className="mt-20 border-t border-ink md:mt-28">
          {SERVICES.map((service, i) => (
            <li
              key={service.title}
              className="grid gap-4 border-b border-black/15 py-10 md:grid-cols-12 md:gap-10 md:py-14"
            >
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-quest md:col-span-2 md:text-3xl">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-3xl font-semibold tracking-[-0.025em] md:col-span-4 md:text-4xl">
                {service.title}
              </h3>
              <p className="max-w-[36rem] text-base leading-relaxed text-black/60 md:col-span-6 md:text-lg md:leading-relaxed">
                {service.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const IDEAS = [
  'Boardroom-level thinking grounded in real operating experience.',
  'Direct, practical and focused on decisions that create durable value.',
];

export function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="bg-ink py-24 md:py-36 xl:py-44">
      <div className={`${container} grid gap-14 lg:grid-cols-12 lg:gap-10`}>
        <Photo
          name="mlungisi-standing"
          sizes="(min-width: 1024px) 40vw, 100vw"
          alt="Mlungisi Mathonsi standing still in a dark overcoat while a crowd moves past him."
          width={941}
          height={1672}
          className="aspect-[4/5] md:aspect-[3/4] lg:col-span-5 lg:aspect-[9/14]"
          imgClassName="grayscale object-[50%_35%]"
        />

        <div className="flex flex-col lg:col-span-6 lg:col-start-7 lg:justify-center">
          <SectionLabel index="03">About</SectionLabel>
          <h2
            id="about-heading"
            className="display mt-10 text-[clamp(2.6rem,5.8vw,6rem)] text-white"
          >
            Mlungisi
            <br />
            Mathonsi
          </h2>
          <p className="mt-10 max-w-[34rem] text-xl leading-relaxed text-white/80 md:text-2xl md:leading-snug">
            An experienced business leader bringing commercial judgement, operational perspective
            and strategic discipline to complex decisions.
          </p>

          <ul className="mt-14 grid gap-10 border-t border-white/10 pt-10 sm:grid-cols-2 md:mt-20">
            {IDEAS.map((idea) => (
              <li key={idea} className="text-base leading-relaxed text-white/60">
                <span aria-hidden className="mb-5 block h-px w-8 bg-quest" />
                {idea}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function VisualProof() {
  return (
    <section aria-labelledby="proof-heading" className="bg-soft py-24 md:py-36 xl:py-44">
      <div className={container}>
        <h2
          id="proof-heading"
          className="display max-w-[18ch] text-[clamp(2.2rem,4.6vw,4.75rem)] text-white"
        >
          Quiet confidence. <span className="text-white/50">Serious ambition.</span>
        </h2>

        <div className="mt-14 grid gap-4 md:mt-20 md:grid-cols-12 md:gap-6">
          <Photo
            name="executive-window"
            sizes="(min-width: 768px) 58vw, 100vw"
            alt="A lone figure silhouetted against floor-to-ceiling glass, looking over a city at dusk."
            width={636}
            height={960}
            className="aspect-[4/5] md:col-span-7 md:aspect-auto md:h-[34rem] xl:h-[40rem]"
            imgClassName="saturate-[.8] object-[50%_72%]"
          />
          <Photo
            name="meeting-warm"
            sizes="(min-width: 768px) 42vw, 100vw"
            alt="Three people in quiet discussion around a meeting table, warm light through a misted window."
            width={640}
            height={1141}
            className="aspect-[4/5] md:col-span-5 md:mt-24 md:aspect-auto md:h-[28rem] xl:h-[34rem]"
            imgClassName="saturate-[.8] object-[50%_70%]"
          />
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="relative isolate overflow-hidden bg-ink"
    >
      <div className={`${container} grid lg:min-h-[52rem] lg:grid-cols-12`}>
        <div className="flex flex-col justify-center py-24 md:py-36 lg:col-span-7 lg:pr-10">
          <SectionLabel index="04">Contact</SectionLabel>
          <h2
            id="contact-heading"
            className="display mt-10 max-w-[15ch] text-[clamp(2.4rem,5.2vw,5.25rem)] text-white"
          >
            What is the decision you cannot afford to get wrong?
          </h2>
          <p className="mt-10 max-w-[34rem] text-lg leading-relaxed text-white/70">
            Tell us where you are, what is changing and what is at stake. Quest4Best will bring an
            experienced perspective to the table.
          </p>

          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Starting a conversation')}`}
            className="group mt-14 inline-flex w-fit items-center gap-4 border-b border-white/25 pb-3 text-2xl font-medium tracking-tight text-white transition-colors hover:border-quest md:text-4xl"
          >
            {CONTACT_EMAIL}
            <ArrowUpRight
              aria-hidden
              className="h-6 w-6 shrink-0 text-quest transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 md:h-8 md:w-8"
            />
          </a>
        </div>

        <div className="relative -mx-6 aspect-[4/5] md:-mx-10 lg:col-span-5 lg:mx-0 lg:aspect-auto xl:-mr-16">
          <picture>
            <source
              type="image/webp"
              srcSet={`${asset('mlungisi-chair-640.webp')} 640w, ${asset('mlungisi-chair.webp')} 1024w`}
              sizes="(min-width: 1024px) 42vw, 100vw"
            />
            <img
              src={asset('mlungisi-chair.jpg')}
              alt=""
              width={1024}
              height={1536}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover grayscale"
            />
          </picture>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink lg:bg-gradient-to-r lg:from-ink lg:via-transparent lg:to-transparent"
          />
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink">
      <div className={`${container} py-14 md:py-16`}>
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <a href="#home" className="inline-block rounded-sm">
              <Logo className="w-[170px]" />
            </a>
            <p className="mt-6 text-sm text-white/50">{BRAND_LINE}</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-white/50 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-14 text-xs text-white/50">
          © {new Date().getFullYear()} Quest4Best Consulting. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
