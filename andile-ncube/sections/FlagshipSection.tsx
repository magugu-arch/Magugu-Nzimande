import { ArrowRight } from "lucide-react";
import { EpisodeCard } from "@/components/EpisodeCard";
import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { Rail } from "@/components/Rail";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass, Eyebrow } from "@/components/ui";
import { episodes } from "@/data/episodes";
import { ctas, flagshipFormat } from "@/data/site";

export function FlagshipSection({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  return (
    <section aria-labelledby="flagship-title" className="theme-dark bg-ink text-paper">
      <Motion>
        <div className="container-site pt-24 md:pt-36">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <Eyebrow className="text-ash">Chapter 03 — The Flagship</Eyebrow>
              <Lines as={headingLevel} id="flagship-title" className="font-display mt-8 text-section" lines={["The Flagship"]} />
              <p className="mt-4 font-serif text-lede italic text-stone" data-reveal="">
                The House That Andile Built
              </p>
              <p className="mt-8 max-w-xl text-ash" data-reveal="">
                The build series, professionalised into appointment viewing. A fixed weekly cadence, a format the
                audience learns, and an edit that treats the house like the main character.
              </p>
              <div className="mt-10 flex flex-wrap gap-3" data-reveal="">
                <TrackedLink href={ctas.watch.href} event="watch_click" eventProps={{ source: "flagship_section" }} className={buttonClass.solid}>
                  {ctas.watch.label}
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
                </TrackedLink>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3 md:gap-4 lg:col-span-6">
              <div className="col-span-6" data-clip="">
                <Media id="IMG_6893" sizes="(min-width: 1024px) 48vw, 100vw" className="aspect-[16/10]" motion="scale" />
              </div>
              <div className="col-span-3" data-reveal="">
                <Media id="IMG_6901" sizes="(min-width: 1024px) 24vw, 50vw" className="aspect-square" />
              </div>
              <div className="col-span-3" data-reveal="">
                <Media id="IMG_6898" sizes="(min-width: 1024px) 24vw, 50vw" className="aspect-square" />
              </div>
            </div>
          </div>

          <ul className="mt-20 grid border-t border-paper/15 sm:grid-cols-2 lg:mt-28 lg:grid-cols-4">
            {flagshipFormat.map((item, i) => (
              <li key={item.title} className="border-b border-paper/15 py-8 sm:pr-8" data-reveal="">
                <p className="meta text-ash">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="font-display mt-3 text-[1.5rem] leading-none">{item.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ash">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div id="episodes" className="scroll-mt-[var(--header-h)] pb-24 pt-20 md:pb-36">
          <div className="container-site flex flex-wrap items-end justify-between gap-4">
            <h3 className="font-display text-card">Episodes</h3>
            <p className="meta max-w-sm text-ash">Episode titles, dates and video will appear as each edit is approved.</p>
          </div>
          <Rail label="Flagship episodes" className="mt-4">
            {episodes.map((episode) => (
              <li key={episode.slug} className="w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]">
                <EpisodeCard episode={episode} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 82vw" />
              </li>
            ))}
          </Rail>
        </div>
      </Motion>
    </section>
  );
}
