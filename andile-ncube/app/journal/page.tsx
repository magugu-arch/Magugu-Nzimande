import { JournalCard } from "@/components/JournalCard";
import { JournalFilter } from "@/components/JournalFilter";
import { Lines } from "@/components/Lines";
import { Motion } from "@/components/Motion";
import { Eyebrow } from "@/components/ui";
import { stories, storyCategories } from "@/data/stories";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Journal",
  description: "Stories from The House That Andile Built — the house, sport, culture, lifestyle, people, building and media.",
  path: "/journal",
  image: "IMG_6906",
});

export default function JournalPage() {
  const lead = stories[0];
  return (
    <div className="theme-light bg-paper pb-24 pt-[calc(var(--header-h)+3rem)] text-ink md:pb-36">
      <Motion className="container-site">
        <Eyebrow className="text-smoke">Journal</Eyebrow>
        <Lines as="h1" className="font-display mt-6 text-[clamp(3rem,1.6rem+6vw,8.5rem)] leading-[0.88]" lines={["Notes from", "the build."]} />
        <p className="mt-6 max-w-xl text-smoke" data-reveal="">
          The house, the people and the business of owning the story. Entries marked draft are awaiting approval.
        </p>

        {lead && (
          <div className="mt-16 border-t border-ink/15 pt-10 md:mt-24" data-reveal="">
            <JournalCard story={lead} large />
          </div>
        )}

        <div className="mt-20 border-t border-ink/15 pt-10">
          <JournalFilter
            categories={storyCategories}
            items={stories.map((s) => ({ slug: s.slug, category: s.category, node: <JournalCard story={s} /> }))}
            featured={lead ? [lead.slug] : []}
          />
        </div>
      </Motion>
    </div>
  );
}
