import { getImageProps } from "next/image";
import { HeroMotion } from "@/components/HeroMotion";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass } from "@/components/ui";
import { getMedia } from "@/data/media";
import { ctas, site } from "@/data/site";
import { ArrowRight } from "lucide-react";

/**
 * Full-viewport opening. Art-directed: the landscape lobby portrait on wide
 * screens (subject right, negative space left for the headline) and the
 * vertical seated portrait on phones. Only one of the two is ever downloaded.
 */
export function Hero() {
  const desktopAsset = getMedia("IMG_6889");
  const mobileAsset = getMedia("IMG_6891");
  const common = { alt: desktopAsset.alt, sizes: "100vw" };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: desktopAsset.src, width: desktopAsset.width, height: desktopAsset.height, quality: 85 });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({ ...common, src: mobileAsset.src, width: mobileAsset.width, height: mobileAsset.height, quality: 85 });

  return (
    <section aria-labelledby="hero-title" className="theme-dark relative isolate overflow-hidden bg-ink text-paper">
      <HeroMotion>
        <div className="relative flex min-h-[100svh] flex-col justify-end md:min-h-[max(100svh,40rem)]">
          <div className="absolute inset-0 -z-10" data-hero-media="">
            <picture>
              <source media="(min-width: 768px)" srcSet={desktop} />
              <source srcSet={mobile} />
              <img
                {...rest}
                // One description that holds for both crops.
                alt="Portrait of Andile Ncube in a suit, warm architectural light behind him."
                fetchPriority="high"
                loading="eager"
                className="size-full object-cover object-[50%_20%] md:object-[72%_30%]"
              />
            </picture>
          </div>
          {/* Legibility: dark negative space on the left (desktop) and bottom (phone). */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/55 to-ink/10 md:bg-linear-to-r md:from-ink md:via-ink/70 md:to-transparent"
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-linear-to-t from-ink to-transparent" />

          <div className="container-site pb-10 pt-32 md:pb-14" data-hero-content="">
            <p className="meta text-stone" data-hero-fade="">
              {site.name}
            </p>
            <h1 id="hero-title" className="font-display mt-5 text-hero md:mt-6">
              <span className="mask-line">
                <span data-hero-line="">The house that</span>
              </span>
              <span className="mask-line">
                <span data-hero-line="">Andile built</span>
              </span>
            </h1>
            <p className="mt-6 max-w-md font-serif text-lede italic text-stone md:mt-8" data-hero-fade="">
              {site.tagline}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 md:mt-10" data-hero-fade="">
              <TrackedLink href={ctas.enter.href} event="hero_cta" eventProps={{ cta: "enter_the_house" }} className={buttonClass.solid}>
                {ctas.enter.label}
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
              </TrackedLink>
              {/* Phones get one primary CTA; PARTNER stays in the header bar. */}
              <span className="hidden md:contents">
                <TrackedLink href={ctas.partner.href} event="hero_cta" eventProps={{ cta: "partner_with_andile" }} className={buttonClass.outline}>
                  {ctas.partner.label}
                </TrackedLink>
              </span>
            </div>
            <div className="mt-12 flex items-center justify-between border-t border-paper/15 pt-5 md:mt-16" data-hero-fade="">
              <p className="meta text-ash">{site.disciplines.join(" • ")}</p>
              <p className="meta hidden text-ash md:block" aria-hidden="true">
                Scroll
              </p>
            </div>
          </div>
        </div>
      </HeroMotion>
    </section>
  );
}
