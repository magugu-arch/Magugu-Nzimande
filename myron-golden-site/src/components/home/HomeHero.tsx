import { getImageProps } from 'next/image';
import { assetSrc, getAsset } from '@/content/assets';
import { ParallaxLayer } from '../media/Parallax';
import { ButtonLink } from '../ui/Button';
import { Eyebrow } from '../ui/Section';

/**
 * The cinematic opener. Art direction: the wide stage image on desktop with
 * Myron on the right third and open space for the headline on the left; the
 * vertical portrait on phones with copy below his eyeline. One <picture>, so
 * only the right file downloads, and it loads eagerly at high priority.
 */
export function HomeHero() {
  const wide = getAsset('MG-02');
  const tall = getAsset('MG-03');
  const common = { alt: wide.alt, sizes: '100vw', quality: 82 as const };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: assetSrc(wide), width: wide.width, height: wide.height });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({
    ...common,
    src: assetSrc(tall),
    width: tall.width,
    height: tall.height,
    fetchPriority: 'high',
    loading: 'eager',
  });

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[max(40rem,100svh)] items-end overflow-hidden bg-ink md:min-h-[max(42rem,94svh)] md:items-center"
    >
      <ParallaxLayer distance={110} scaleFrom={1.04} className="-z-20">
        <picture>
          <source media="(min-width: 768px)" srcSet={desktop} />
          <img
            {...rest}
            srcSet={mobile}
            alt={rest.alt}
            className="absolute inset-0 h-full w-full object-cover object-[55%_12%] md:object-[70%_30%]"
          />
        </picture>
      </ParallaxLayer>

      {/* Shade: bottom-up on phones (copy sits low), left-to-right on wider screens. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-ink)_14%,rgb(17_17_20/0.9)_50%,rgb(17_17_20/0.2)_76%,rgb(17_17_20/0.4))] md:bg-[linear-gradient(to_right,var(--color-ink)_0%,rgb(17_17_20/0.88)_30%,rgb(17_17_20/0.2)_62%,transparent)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-ink to-transparent"
      />

      {/* Gold geometry: two arcs echoing the stage, drifting against the photo. */}
      <ParallaxLayer distance={-50} scaleFrom={1} className="-z-10 hidden md:block">
        <svg
          aria-hidden="true"
          className="gold-draw absolute top-[18%] left-[-6%] h-[78%] w-auto text-gold/35"
          viewBox="0 0 600 700"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <path
            style={{ ['--len' as string]: 1500 }}
            d="M40 700V330C40 165 165 40 300 40s260 125 260 290v370"
          />
          <path
            style={{ ['--len' as string]: 1300 }}
            d="M90 700V340C90 200 190 95 300 95s210 105 210 245v360"
            className="text-gold/60"
          />
        </svg>
      </ParallaxLayer>

      <div className="container-site pt-[calc(var(--header-h)+2rem)] pb-14 md:pb-0">
        <div className="max-w-[40rem]">
          <Eyebrow className="mb-6">
            <span className="md:hidden">Offers · Sales · Purpose</span>
            <span className="hidden md:inline">Business growth · Sales strategy · Purpose</span>
          </Eyebrow>
          <h1 id="hero-title" className="type-display-xl">
            Build the offers.
            <br />
            Master the sale.
            <br />
            <span className="text-gold-bright italic">Grow with purpose.</span>
          </h1>
          <p className="type-lede mt-7 max-w-[34rem] text-ivory/80">
            Myron Golden teaches entrepreneurs to create offers people want, sell them with
            integrity, and build a business on timeless, Biblical principles.
          </p>
          <div className="mt-9 flex flex-col gap-3 xs:flex-row">
            <ButtonLink href="/learn" size="lg" arrow>
              Start with free training
            </ButtonLink>
            <ButtonLink href="/programs" size="lg" variant="secondary">
              Explore programs
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
