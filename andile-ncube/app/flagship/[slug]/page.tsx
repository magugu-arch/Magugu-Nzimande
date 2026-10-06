import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeCard } from "@/components/EpisodeCard";
import { EpisodePlayer } from "@/components/EpisodePlayer";
import { JournalCard } from "@/components/JournalCard";
import { Media } from "@/components/Media";
import { TrackedLink } from "@/components/TrackedLink";
import { buttonClass, PendingTag } from "@/components/ui";
import { episodeLabel, episodes, getEpisode } from "@/data/episodes";
import { getMedia } from "@/data/media";
import { ctas, site } from "@/data/site";
import { stories } from "@/data/stories";
import { absoluteUrl, JsonLd, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return episodes.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/flagship/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const episode = getEpisode(slug);
  if (!episode) return {};
  return pageMetadata({
    title: `${episodeLabel(episode)}${episode.title ? ` — ${episode.title}` : ""}`,
    description: `${site.property}, ${episodeLabel(episode).toLowerCase()}. ${episode.summary}`,
    path: `/flagship/${episode.slug}`,
    image: episode.poster,
    // Placeholder episodes exist for layout only; keep them out of search.
    noindex: episode.status !== "published",
  });
}

export default async function EpisodePage({ params }: PageProps<"/flagship/[slug]">) {
  const { slug } = await params;
  const episode = getEpisode(slug);
  if (!episode) notFound();

  const others = episodes.filter((e) => e.slug !== episode.slug).slice(0, 3);
  const relatedStories = stories.filter((s) => episode.related.includes(s.slug) || s.category === "The House").slice(0, 2);
  const label = episodeLabel(episode);

  return (
    <>
      {episode.video && episode.status === "published" && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: episode.title ?? label,
            description: episode.summary,
            thumbnailUrl: absoluteUrl(getMedia(episode.poster).src),
            uploadDate: episode.releaseDate,
            contentUrl: absoluteUrl(episode.video.src),
            partOfSeries: { "@type": "CreativeWorkSeries", name: site.property },
          }}
        />
      )}
      <article className="theme-dark bg-ink pb-24 pt-[calc(var(--header-h)+2rem)] text-paper md:pb-36">
        <div className="container-site">
          <Link href="/flagship#episodes" className="meta inline-flex min-h-11 items-center gap-2 text-ash hover:text-paper">
            <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} /> All episodes
          </Link>
          <div className="mt-6 grid gap-10 lg:grid-cols-12">
            {/* Persistent player: holds its place on wide screens while the notes scroll. */}
            <div className="lg:col-span-7">
              <div className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
                <EpisodePlayer episode={episode} />
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="meta text-ash">
                  {site.property} · {label}
                </p>
                <PendingTag status={episode.status} />
              </div>
              <h1 className="font-display mt-4 text-[clamp(2.5rem,1.6rem+3.4vw,5rem)] leading-[0.9]">{episode.title ?? "Title to be confirmed"}</h1>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-paper/15 py-4">
                <div>
                  <dt className="meta text-ash">Release</dt>
                  <dd className="mt-1">{episode.releaseDate ?? "To be confirmed"}</dd>
                </div>
                <div>
                  <dt className="meta text-ash">Runtime</dt>
                  <dd className="mt-1">
                    {episode.video?.durationSeconds ? `${Math.round(episode.video.durationSeconds / 60)} min` : "To be confirmed"}
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-ash">{episode.summary}</p>

              <section aria-labelledby="behind" className="mt-12">
                <h2 id="behind" className="meta text-stone">
                  Behind the build
                </h2>
                <p className="mt-3 text-ash">{episode.behindTheBuild}</p>
              </section>

              <section aria-labelledby="moments" className="mt-12">
                <h2 id="moments" className="meta text-stone">
                  Key moments
                </h2>
                <ol className="mt-3 divide-y divide-paper/15 border-y border-paper/15">
                  {episode.keyMoments.map((m, i) => (
                    <li key={i} className="flex min-h-12 items-center justify-between gap-4 py-3">
                      <span>
                        {m.label} {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="meta text-ash">{m.timestamp ?? "—"}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[0.9rem] text-ash">Timestamps are added when the episode is published.</p>
              </section>

              <section aria-labelledby="shorts" className="mt-12">
                <h2 id="shorts" className="meta text-stone">
                  Shorts
                </h2>
                <ul className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto">
                  {episode.shorts.map((s, i) => (
                    <li key={i} className="w-[38%] shrink-0 snap-start sm:w-[30%]">
                      <Media id={s.image} sizes="(min-width: 1024px) 12vw, 38vw" className="aspect-[9/16]" decorative />
                      <p className="meta mt-2 text-ash">{s.title ?? `Short ${String(i + 1).padStart(2, "0")} — placeholder`}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="mt-12 flex flex-wrap gap-3">
                <TrackedLink href={ctas.pilot.href} event="partnership_start" eventProps={{ source: "episode", episode: episode.slug }} className={buttonClass.solid}>
                  Sponsor the Flagship
                  <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                </TrackedLink>
              </div>
            </div>
          </div>
        </div>
      </article>

      <section aria-labelledby="more" className="theme-dark border-t border-paper/10 bg-charcoal py-20 text-paper md:py-28">
        <div className="container-site">
          <h2 id="more" className="font-display text-card">
            More episodes
          </h2>
          <ul className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((e) => (
              <li key={e.slug}>
                <EpisodeCard episode={e} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" />
              </li>
            ))}
          </ul>
          {relatedStories.length > 0 && (
            <>
              <h2 className="font-display mt-20 text-card">Related stories</h2>
              <ul className="mt-8 grid gap-10 md:grid-cols-2">
                {relatedStories.map((s) => (
                  <li key={s.slug}>
                    <JournalCard story={s} tone="dark" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  );
}
