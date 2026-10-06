import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { Eyebrow } from "@/components/ui";
import { pillars } from "@/data/site";

/** The ownership shift, stated plainly, then the four pillars that deliver it. */
export function ChapterIntro() {
  return (
    <section aria-labelledby="intro-title" className="theme-dark bg-ink text-paper">
      <Motion className="container-site py-24 md:py-36">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Eyebrow className="text-ash">Chapter 01 — Broadcaster → Owner</Eyebrow>
            <Lines
              id="intro-title"
              className="font-display mt-8 text-section"
              lines={["For years, Andile", "built audiences", "for other people."]}
            />
            <Lines
              as="p"
              className="mt-8 font-serif text-[clamp(1.75rem,1.2rem+2.2vw,3.5rem)] leading-[1.05] text-stone italic"
              lines={["Now the audience, the show", "and the IP can belong to him."]}
            />
          </div>
          <div className="lg:col-span-5 lg:pt-24">
            <div data-clip="">
              <Media
                id="IMG_6899"
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="aspect-[4/5]"
                focus="64% 40%"
                motion="scale"
              />
            </div>
          </div>
        </div>

        <ol className="mt-24 grid border-t border-paper/15 md:mt-32 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <li key={p.index} className="border-b border-paper/15 md:odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0" data-reveal="">
              <Link href={p.href} className="group flex h-full min-h-56 flex-col gap-4 p-6 transition-colors hover:bg-charcoal md:p-8">
                <span className="meta flex items-center justify-between text-ash">
                  {p.index}
                  <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
                </span>
                <span className="font-display mt-10 text-card">{p.title}</span>
                <span className="text-[0.95rem] leading-relaxed text-ash">{p.body}</span>
              </Link>
            </li>
          ))}
        </ol>
      </Motion>
    </section>
  );
}
