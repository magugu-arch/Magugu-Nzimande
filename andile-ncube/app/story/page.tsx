import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImageFeature } from "@/components/ImageFeature";
import { Lines } from "@/components/Lines";
import { Media } from "@/components/Media";
import { Motion } from "@/components/Motion";
import { PageHero } from "@/components/PageHero";
import { buttonClass, Eyebrow, PendingTag } from "@/components/ui";
import { biography } from "@/data/press";
import { ctas } from "@/data/site";
import { pageMetadata } from "@/lib/seo";
import { OwnershipStatement } from "@/sections/OwnershipStatement";

export const metadata = pageMetadata({
  title: "The Story",
  description: "Andile Ncube: broadcaster, host and storyteller — and now an owner, building the platform rather than appearing on it.",
  path: "/story",
  image: "IMG_6891",
});

const roles = [
  { title: "Owner", body: "Of the show, the audience relationship and the IP." },
  { title: "Broadcaster", body: "The credibility that makes an owned platform worth watching." },
  { title: "Host", body: "The voice that carries the flagship from week to week." },
  { title: "Storyteller", body: "Turning a build into a story an audience follows." },
];

export default function StoryPage() {
  return (
    <>
      <PageHero eyebrow="The Story" title={["Broadcaster", "→ Owner."]} image="IMG_6899" focus="62% 30%" />

      <section aria-labelledby="bio-title" className="theme-light bg-paper py-24 text-ink md:py-36">
        <Motion className="container-site grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5" data-clip="">
            <Media id="IMG_6891" sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[4/5]" motion="scale" />
          </div>
          <div className="lg:col-span-6 lg:col-start-7 lg:pt-16">
            <div className="flex items-center gap-3" data-reveal="">
              <Eyebrow className="text-smoke">Andile Ncube</Eyebrow>
              <PendingTag status={biography.status} />
            </div>
            <h2 id="bio-title" className="sr-only">
              Biography
            </h2>
            {biography.paragraphs.map((p) => (
              <p key={p} className="mt-8 font-serif text-[clamp(1.6rem,1.15rem+1.7vw,2.75rem)] leading-[1.15]" data-reveal="">
                {p}
              </p>
            ))}
            <ul className="mt-14 grid gap-px bg-ink/15 sm:grid-cols-2">
              {roles.map((r) => (
                <li key={r.title} className="bg-paper py-6 sm:pr-6" data-reveal="">
                  <h3 className="font-display text-card">{r.title}</h3>
                  <p className="mt-2 text-smoke">{r.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Motion>
      </section>

      <ImageFeature eyebrow="Sport" title={["Years around", "the big moments."]} image="IMG_6903" tone="dark">
        <p>Broadcast credibility is the foundation. The next move turns that credibility into something owned.</p>
      </ImageFeature>

      <ImageFeature eyebrow="The next move" title={["Build the platform,", "not just appear on it."]} image="IMG_6889" reverse tone="stone">
        <p>The House That Andile Built is where that begins: a show he owns, about something he is building.</p>
        <p>
          <Link href="/house" className={`${buttonClass.text} text-ink`}>
            {ctas.enter.label} <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </Link>
        </p>
      </ImageFeature>

      <OwnershipStatement />

      <section className="theme-light bg-paper py-20 text-ink">
        <Motion className="container-site flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <Lines className="font-display text-section" lines={["Build with him."]} />
          <div data-reveal="">
            <Link href={ctas.partner.href} className={buttonClass.solidDark}>
              {ctas.partner.label}
              <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </Link>
          </div>
        </Motion>
      </section>
    </>
  );
}
