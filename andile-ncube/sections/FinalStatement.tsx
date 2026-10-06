import { ArrowRight } from "lucide-react";
import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass } from "@/components/ui";
import { ctas } from "@/data/site";

export function FinalStatement() {
  return (
    <section aria-labelledby="final-title" className="theme-dark relative isolate overflow-hidden bg-ink text-paper">
      <Motion>
        <div className="absolute inset-0 -z-10 opacity-45">
          <Media id="IMG_6896" sizes="100vw" className="size-full" motion="parallax" decorative />
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-ink via-ink/75 to-ink/30" />
        <div className="container-site flex min-h-[85svh] flex-col justify-center py-28">
          <Lines
            as="h2"
            id="final-title"
            className="font-display text-[clamp(3rem,1.4rem+7.4vw,9.375rem)] leading-[0.86]"
            lines={["Build the house.", "Own the story.", "Keep the IP."]}
          />
          <div className="mt-12 flex flex-wrap gap-3" data-reveal="">
            <TrackedLink href={ctas.partner.href} event="partnership_start" eventProps={{ source: "final" }} className={buttonClass.solid}>
              {ctas.partner.label}
              <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
            </TrackedLink>
            <TrackedLink href={ctas.watch.href} event="watch_click" eventProps={{ source: "final" }} className={buttonClass.outline}>
              {ctas.watch.label}
            </TrackedLink>
          </div>
        </div>
      </Motion>
    </section>
  );
}
