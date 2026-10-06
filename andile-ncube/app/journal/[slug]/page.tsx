import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JournalCard } from "@/components/JournalCard";
import { Media } from "@/components/Media";
import { TrackRead } from "@/components/TrackRead";
import { buttonClass, PendingTag } from "@/components/ui";
import { getMedia } from "@/data/media";
import { ctas, site } from "@/data/site";
import { getStory, stories } from "@/data/stories";
import { absoluteUrl, JsonLd, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return stories.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const story = getStory(slug);
  if (!story) return {};
  return {
    ...pageMetadata({ title: story.title, description: story.excerpt, path: `/journal/${story.slug}`, image: story.cover }),
  };
}

export default async function StoryPage({ params }: PageProps<"/journal/[slug]">) {
  const { slug } = await params;
  const story = getStory(slug);
  if (!story) notFound();
  const more = stories.filter((s) => s.slug !== story.slug).slice(0, 2);

  return (
    <article className="theme-light bg-paper pb-24 pt-[calc(var(--header-h)+3rem)] text-ink md:pb-36">
      {story.status === "published" && story.publishedAt && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Article",
            headline: story.title,
            description: story.excerpt,
            image: absoluteUrl(getMedia(story.cover).src),
            datePublished: story.publishedAt,
            author: { "@type": "Person", name: site.name, url: absoluteUrl("/story") },
            mainEntityOfPage: absoluteUrl(`/journal/${story.slug}`),
          }}
        />
      )}
      <div className="container-site">
        <Link href="/journal" className="meta inline-flex min-h-11 items-center gap-2 text-smoke hover:text-ink">
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} /> Journal
        </Link>
        <header className="mx-auto mt-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="meta text-smoke">{story.category}</p>
            <PendingTag status={story.status} />
          </div>
          <h1 className="font-display mt-5 text-[clamp(2.75rem,1.6rem+4.6vw,6.5rem)] leading-[0.9]">{story.title}</h1>
          <p className="mt-6 font-serif text-lede italic">{story.excerpt}</p>
        </header>
        <Media id={story.cover} sizes="(min-width: 1536px) 1408px, 100vw" className="mt-12 aspect-[16/9] md:mt-16" preload />
        <div className="mx-auto mt-12 max-w-2xl space-y-6 text-[1.125rem] leading-[1.75] md:mt-16">
          {story.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <TrackRead slug={story.slug} />
        <div className="mx-auto mt-14 max-w-2xl border-t border-ink/15 pt-8">
          <Link href={ctas.partner.href} className={buttonClass.solidDark}>
            {ctas.partner.label}
            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </Link>
        </div>

        <section aria-labelledby="more-stories" className="mt-24 border-t border-ink/15 pt-12">
          <h2 id="more-stories" className="font-display text-card">
            More from the journal
          </h2>
          <ul className="mt-10 grid gap-12 md:grid-cols-2">
            {more.map((s) => (
              <li key={s.slug}>
                <JournalCard story={s} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}
