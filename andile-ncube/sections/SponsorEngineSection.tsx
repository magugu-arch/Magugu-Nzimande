import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { SponsorGrid } from "@/components/SponsorGrid";
import { Eyebrow } from "@/components/ui";
import { sponsorCategories } from "@/data/sponsors";

export function SponsorEngineSection({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  return (
    <section id="sponsor-engine" aria-labelledby="sponsor-title" className="theme-dark scroll-mt-[var(--header-h)] bg-ink py-24 text-paper md:py-36">
      <Motion className="container-site">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow className="text-ash">Chapter 05 — The Sponsor Engine</Eyebrow>
            <Lines as={headingLevel} id="sponsor-title" className="font-display mt-8 text-section" lines={["The Sponsor", "Engine"]} />
            <Lines
              as="p"
              className="mt-8 max-w-2xl font-serif text-[clamp(1.5rem,1.1rem+1.6vw,2.75rem)] leading-[1.08] italic text-stone"
              lines={["Don’t place a logo in the story.", "Build the story around the category."]}
            />
          </div>
          <div className="lg:col-span-5" data-clip="">
            <Media id="IMG_6902" sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[16/10]" motion="scale" />
          </div>
        </div>
        <p className="mt-12 max-w-2xl text-ash md:mt-16" data-reveal="">
          Five categories the build genuinely needs, each with a defined partner role. Choose a category to see why it
          fits, where it appears, the content it opens up and the inventory it carries.
        </p>
        <div className="mt-12 md:mt-16" data-reveal="">
          <SponsorGrid categories={sponsorCategories} />
        </div>
      </Motion>
    </section>
  );
}
