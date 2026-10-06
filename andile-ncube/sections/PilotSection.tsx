import { ArrowRight } from "lucide-react";
import { Lines } from "@/components/Lines";
import { Motion } from "@/components/Motion";
import { PilotTimeline } from "@/components/PilotTimeline";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass, Eyebrow } from "@/components/ui";
import { ctas } from "@/data/site";

export function PilotSection() {
  return (
    <section aria-labelledby="pilot-title" className="theme-dark bg-charcoal py-24 text-paper md:py-36">
      <Motion className="container-site grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+3rem)]">
            <Eyebrow className="text-ash">The 90-day pilot</Eyebrow>
            <Lines id="pilot-title" className="font-display mt-8 text-section" lines={["Ninety days", "to prove it."]} />
            <p className="mt-8 max-w-md text-ash" data-reveal="">
              A proving period in three phases of thirty days: stabilise the flagship, package and pitch it, then extend
              and formalise.
            </p>
            <div className="mt-10" data-reveal="">
              <TrackedLink href={ctas.pilot.href} event="partnership_start" eventProps={{ source: "pilot" }} className={buttonClass.solid}>
                {ctas.pilot.label}
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
              </TrackedLink>
            </div>
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <PilotTimeline />
        </div>
      </Motion>
    </section>
  );
}
