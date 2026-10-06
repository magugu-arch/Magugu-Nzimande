import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { Eyebrow } from "@/components/ui";
import { institutionPhases } from "@/data/site";

const chain = ["One show", "Partner programme", "Multiple formats", "Co-production", "Owned IP"];

export function InstitutionSection() {
  return (
    <section id="institution" aria-labelledby="institution-title" className="theme-light scroll-mt-[var(--header-h)] bg-paper py-24 text-ink md:py-36">
      <Motion className="container-site">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Eyebrow className="text-smoke">Chapter 06 — The Institution</Eyebrow>
            <Lines id="institution-title" className="font-display mt-8 text-section" lines={["The Institution"]} />
            <p className="mt-8 max-w-xl text-lede" data-reveal="">
              The long game: from one show to a body of work that compounds — and stays owned.
            </p>
            <ol className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="The path from one show to owned IP" data-reveal="">
              {chain.map((step, i) => (
                <li key={step} className="meta flex items-center gap-3">
                  {step}
                  {i < chain.length - 1 && <span aria-hidden="true" className="text-smoke">→</span>}
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:col-span-5 lg:col-start-8" data-clip="">
            <Media id="IMG_6900" sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[4/3]" motion="scale" />
          </div>
        </div>
        <ol className="mt-16 grid gap-px bg-ink/15 md:mt-24 md:grid-cols-2 lg:grid-cols-4">
          {institutionPhases.map((p, i) => (
            <li key={p.phase} className="flex min-h-64 flex-col bg-paper p-6 md:p-8" data-reveal="">
              <p className="meta text-smoke">{p.phase}</p>
              <div aria-hidden="true" className="mt-6 flex gap-1">
                {institutionPhases.map((_, j) => (
                  <span key={j} className={`h-1 flex-1 ${j <= i ? "bg-ink" : "bg-ink/15"}`} />
                ))}
              </div>
              <h3 className="font-display mt-auto pt-10 text-card">{p.title}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-smoke">{p.body}</p>
            </li>
          ))}
        </ol>
      </Motion>
    </section>
  );
}
