import { ArrowRight } from "lucide-react";
import { FormatCard } from "@/components/FormatCard";
import { Lines } from "@/components/Lines";
import { Motion } from "@/components/Motion";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass, Eyebrow } from "@/components/ui";
import { formats } from "@/data/formats";
import { ctas } from "@/data/site";

export function SlateSection() {
  return (
    <section aria-labelledby="slate-title" className="theme-light bg-stone py-24 text-ink md:py-36">
      <Motion className="container-site">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <Eyebrow className="text-smoke">Chapter 04 — The Slate</Eyebrow>
            <Lines id="slate-title" className="font-display mt-8 text-section" lines={["The Slate"]} />
            <p className="mt-4 font-serif text-lede italic" data-reveal="">
              One hit becomes a channel.
            </p>
          </div>
          <p className="self-end text-smoke md:col-span-4 md:col-start-9" data-reveal="">
            A portfolio of owned formats across three territories. Each carries its real status — concept, in
            development, pilot or live — and no name until one is approved.
          </p>
        </div>
        <ul className="mt-14 grid gap-12 md:mt-20 md:grid-cols-3 md:gap-6 lg:gap-10">
          {formats.map((format) => (
            <li key={format.slug} data-reveal="">
              <FormatCard format={format} href={`/slate#${format.slug}`} />
            </li>
          ))}
        </ul>
        <div className="mt-14" data-reveal="">
          <TrackedLink href={ctas.slate.href} event="slate_click" eventProps={{ source: "home" }} className={buttonClass.solidDark}>
            {ctas.slate.label}
            <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
          </TrackedLink>
        </div>
      </Motion>
    </section>
  );
}
