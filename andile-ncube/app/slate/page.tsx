import { ArrowRight } from "lucide-react";
import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { PageHero } from "@/components/PageHero";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass, Eyebrow, StatusChip } from "@/components/ui";
import { formats, statusLabels } from "@/data/formats";
import { pageMetadata } from "@/lib/seo";
import { InstitutionSection } from "@/sections/InstitutionSection";

export const metadata = pageMetadata({
  title: "The Slate",
  description: "One hit becomes a channel: Andile Ncube's owned-format slate across sport, lifestyle and fatherhood.",
  path: "/slate",
  image: "IMG_6903",
});

export default function SlatePage() {
  return (
    <>
      <PageHero eyebrow="The Slate" title={["One hit", "becomes", "a channel."]} lede="Owned formats across sport, lifestyle and fatherhood." image="IMG_6903" focus="40% 30%" />

      <section aria-label="Format status key" className="theme-light bg-stone py-10 text-ink">
        <div className="container-site flex flex-wrap items-center gap-x-8 gap-y-3">
          <p className="meta text-smoke">Status key</p>
          {Object.entries(statusLabels).map(([key, label]) => (
            <p key={key} className="meta">
              {label}
            </p>
          ))}
          <p className="text-[0.9rem] text-smoke md:ml-auto">Statuses reflect what is confirmed today and change as formats move.</p>
        </div>
      </section>

      {formats.map((format, i) => {
        const dark = i % 2 === 0;
        return (
          <section
            key={format.slug}
            id={format.slug}
            aria-labelledby={`${format.slug}-title`}
            className={`${dark ? "theme-dark bg-ink text-paper" : "theme-light bg-paper text-ink"} scroll-mt-[var(--header-h)] py-24 md:py-32`}
          >
            <Motion className="container-site grid gap-12 lg:grid-cols-12">
              <div className={`lg:col-span-5 ${i % 2 ? "lg:order-2 lg:col-start-8" : ""}`}>
                <Eyebrow className={dark ? "text-ash" : "text-smoke"}>{`Territory ${String(i + 1).padStart(2, "0")}`}</Eyebrow>
                <div className="mt-6 flex items-center gap-4" data-reveal="">
                  <StatusChip status={format.status} />
                </div>
                <Lines id={`${format.slug}-title`} className="font-display mt-6 text-section" lines={[format.territory]} />
                <p className="mt-2 meta opacity-75" data-reveal="">
                  {format.name ?? "Format name to be confirmed"}
                </p>
                <p className="mt-8 font-serif text-lede italic" data-reveal="">
                  {format.message}
                </p>
                <p className={`mt-6 ${dark ? "text-ash" : "text-smoke"}`} data-reveal="">
                  {format.description}
                </p>
                {format.themes.length > 0 && (
                  <ul className="mt-8 flex flex-wrap gap-2" aria-label="Potential territories" data-reveal="">
                    {format.themes.map((t) => (
                      <li key={t} className="meta border border-current/30 px-3 py-1.5">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-10" data-reveal="">
                  <TrackedLink
                    href="/partners?opportunity=present-format#enquire"
                    event="slate_click"
                    eventProps={{ format: format.slug, cta: "present_a_format" }}
                    className={dark ? buttonClass.solid : buttonClass.solidDark}
                  >
                    Present this format
                    <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  </TrackedLink>
                </div>
              </div>
              <div className={`lg:col-span-6 ${i % 2 ? "lg:order-1" : "lg:col-start-7"}`}>
                {format.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {format.images.map((img, j) => (
                      <div key={img} className={format.images.length === 1 || j === 0 ? "col-span-2" : ""} data-clip="">
                        <Media id={img} sizes="(min-width: 1024px) 48vw, 100vw" className={j === 0 ? "aspect-[4/3]" : "aspect-[16/9]"} motion="scale" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-end bg-charcoal p-8 text-paper" data-reveal="">
                    <p className="max-w-sm text-ash">
                      No imagery is shown for this territory until family content is approved for publication.
                    </p>
                  </div>
                )}
              </div>
            </Motion>
          </section>
        );
      })}
      <InstitutionSection />
    </>
  );
}
