import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HouseTimeline } from "@/components/HouseTimeline";
import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { buttonClass, Eyebrow } from "@/components/ui";
import { houseStages } from "@/data/site";

export function HouseSection({ withLink = true }: { withLink?: boolean }) {
  return (
    <section aria-labelledby="house-title" className="theme-light bg-paper text-ink">
      <Motion>
        <div className="relative">
          <Media
            id="IMG_6897"
            sizes="100vw"
            className="h-[70svh] min-h-[26rem] md:h-[88svh]"
            motion="parallax"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink/80 via-ink/10 to-transparent" />
          <div className="theme-dark container-site absolute inset-x-0 bottom-0 pb-10 text-paper md:pb-16">
            <Eyebrow className="text-stone">Chapter 02 — The House</Eyebrow>
            <Lines
              id="house-title"
              className="font-display mt-6 text-section"
              lines={["Vision. Foundation.", "Build. Reveal.", "Ownership."]}
            />
          </div>
        </div>

        <div className="container-site py-20 md:py-28">
          <div className="grid gap-8 md:grid-cols-12">
            <p className="text-lede md:col-span-7" data-reveal="">
              The House That Andile Built is the hero media property: a real build, documented from the first plan to
              the keys — and the platform he owns at the end of it.
            </p>
            <p className="text-smoke md:col-span-4 md:col-start-9" data-reveal="">
              Stage status is published as the build progresses. Nothing on this page claims a stage is complete until
              it is.
            </p>
          </div>
          <div className="mt-16 md:mt-24">
            <HouseTimeline stages={houseStages} />
          </div>
          {withLink && (
            <div className="mt-12" data-reveal="">
              <Link href="/house" className={buttonClass.solidDark}>
                Enter the House
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
              </Link>
            </div>
          )}
        </div>
      </Motion>
    </section>
  );
}
