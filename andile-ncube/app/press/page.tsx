import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DocumentDownloads, PhotoDownloads } from "@/components/PressDownloads";
import { Lines } from "@/components/Lines";
import { Motion } from "@/components/Motion";
import { buttonClass, Eyebrow, PendingTag } from "@/components/ui";
import { biography, headshots, pressDownloads, pressPhotographs, showInformation } from "@/data/press";
import { mediaContact, partnershipDeck } from "@/data/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Press / Media",
  description: "Press kit for Andile Ncube and The House That Andile Built: biography, headshots, show information, photographs and media contact.",
  path: "/press",
  image: "IMG_6891",
});

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-[calc(var(--header-h)+1rem)] gap-8 border-t border-ink/15 py-14 lg:grid-cols-12">
      <h2 id={`${id}-title`} className="font-display text-card lg:col-span-3">
        {title}
      </h2>
      <div className="lg:col-span-8 lg:col-start-5">{children}</div>
    </section>
  );
}

export default function PressPage() {
  return (
    <div className="theme-light bg-paper pb-24 pt-[calc(var(--header-h)+3rem)] text-ink md:pb-36">
      <Motion className="container-site">
        <Eyebrow className="text-smoke">Press / Media</Eyebrow>
        <Lines as="h1" className="font-display mt-6 text-[clamp(3rem,1.6rem+6vw,8.5rem)] leading-[0.88]" lines={["Press kit."]} />
        <nav aria-label="Press kit sections" className="mt-10 flex flex-wrap gap-x-6 gap-y-1" data-reveal="">
          {[
            ["biography", "Biography"],
            ["headshots", "Headshots"],
            ["show", "Show information"],
            ["photographs", "Press photographs"],
            ["downloads", "Downloads"],
            ["contact", "Media contact"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="meta inline-flex min-h-11 items-center text-smoke hover:text-ink">
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-14">
          <Block id="biography" title="Biography">
            <PendingTag status={biography.status} />
            {biography.paragraphs.map((p) => (
              <p key={p} className="mt-4 font-serif text-lede">
                {p}
              </p>
            ))}
            <p className="mt-4 text-[0.95rem] text-smoke">Suggested opening, subject to approval. The full approved biography will be published here.</p>
          </Block>

          <Block id="headshots" title="Headshots">
            <PhotoDownloads ids={headshots} kind="headshot" />
          </Block>

          <Block id="show" title="Show information">
            <h3 className="meta text-smoke">{showInformation.title}</h3>
            <p className="mt-3 max-w-2xl">{showInformation.body}</p>
          </Block>

          <Block id="photographs" title="Press photographs">
            <PhotoDownloads ids={pressPhotographs} kind="press_photo" />
          </Block>

          <Block id="downloads" title="Downloads">
            <DocumentDownloads files={[...pressDownloads, partnershipDeck]} />
          </Block>

          <Block id="contact" title="Media contact">
            {mediaContact ? (
              <p>
                {mediaContact.name} —{" "}
                <a href={`mailto:${mediaContact.email}`} className="underline underline-offset-4">
                  {mediaContact.email}
                </a>
              </p>
            ) : (
              <>
                <p className="max-w-xl text-smoke">
                  A dedicated media contact will be listed here. Until then, send media requests through the enquiry form
                  and choose “Media Partnership”.
                </p>
                <Link href="/partners?opportunity=media-partnership#enquire" className={`${buttonClass.solidDark} mt-6`}>
                  Media enquiry <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                </Link>
              </>
            )}
          </Block>
        </div>
      </Motion>
    </div>
  );
}
