import { ArrowRight } from "lucide-react";
import { DeckRequest } from "@/components/DeckRequest";
import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass, Eyebrow } from "@/components/ui";
import { ctas, partnershipDeck } from "@/data/site";

export function BuildWithUs() {
  return (
    <section id="deck" aria-labelledby="deck-title" className="theme-light scroll-mt-[var(--header-h)] bg-stone py-24 text-ink md:py-36">
      <Motion className="container-site grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Eyebrow className="text-smoke">Partnership deck</Eyebrow>
          <Lines id="deck-title" className="font-display mt-8 text-section" lines={["Build with us."]} />
          <p className="mt-8 max-w-lg text-lede" data-reveal="">
            {partnershipDeck.description}
          </p>
          <div className="mt-10 flex flex-col items-start gap-6" data-reveal="">
            <DeckRequest deck={partnershipDeck} />
            <TrackedLink href={ctas.call.href} event="partnership_start" eventProps={{ source: "request_call" }} className={`${buttonClass.text} w-fit`}>
              {ctas.call.label}
              <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
            </TrackedLink>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 lg:col-span-6">
          <div className="col-span-3" data-clip="">
            <Media id="IMG_6890" sizes="(min-width: 1024px) 30vw, 60vw" className="aspect-[3/4]" focus="58% 40%" />
          </div>
          <div className="col-span-2 self-end" data-reveal="">
            <Media id="IMG_6892" sizes="(min-width: 1024px) 20vw, 40vw" className="aspect-[3/4]" focus="70% 30%" />
          </div>
        </div>
      </Motion>
    </section>
  );
}
