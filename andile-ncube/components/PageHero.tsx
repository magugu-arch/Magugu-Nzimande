import type { ReactNode } from "react";
import type { MediaId } from "@/lib/types";
import { Lines } from "./Lines";
import { Media } from "./Media";
import { Motion } from "./Motion";

/** Opening for inner pages: one image, one headline, set low in the frame. */
export function PageHero({
  eyebrow,
  title,
  lede,
  image,
  focus,
  children,
}: {
  eyebrow: string;
  title: string[];
  lede?: string;
  image: MediaId;
  focus?: string;
  children?: ReactNode;
}) {
  return (
    <section className="theme-dark relative isolate overflow-hidden bg-ink text-paper">
      <Motion>
        <div className="absolute inset-0 -z-10">
          <Media id={image} sizes="100vw" className="size-full" focus={focus} preload quality={85} motion="parallax" />
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/60 to-ink/20 md:bg-linear-to-r md:from-ink md:via-ink/65 md:to-ink/5" />
        <div className="container-site flex min-h-[78svh] flex-col justify-end pb-12 pt-32 md:min-h-[82svh] md:pb-16">
          <p className="meta text-stone" data-reveal="">
            {eyebrow}
          </p>
          <Lines as="h1" className="font-display mt-6 text-[clamp(3rem,1.6rem+6vw,8.5rem)] leading-[0.88]" lines={title} />
          {lede && (
            <p className="mt-6 max-w-xl font-serif text-lede italic text-stone md:mt-8" data-reveal="">
              {lede}
            </p>
          )}
          {children && (
            <div className="mt-8 flex flex-wrap gap-3" data-reveal="">
              {children}
            </div>
          )}
        </div>
      </Motion>
    </section>
  );
}
