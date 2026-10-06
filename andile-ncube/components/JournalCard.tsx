import Link from "next/link";
import type { Story } from "@/lib/types";
import { Media } from "./Media";
import { PendingTag } from "./ui";

export function JournalCard({ story, tone = "light", large = false }: { story: Story; tone?: "light" | "dark"; large?: boolean }) {
  const muted = tone === "dark" ? "text-ash" : "text-smoke";
  return (
    <Link href={`/journal/${story.slug}`} className="group block">
      <Media
        id={story.cover}
        sizes={large ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"}
        className={large ? "aspect-[16/10]" : "aspect-[4/3]"}
        imgClassName="transition-transform duration-[1.2s] ease-[var(--ease-cinematic)] group-hover:scale-[1.04]"
        decorative
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className={`meta ${muted}`}>{story.category}</p>
        <PendingTag status={story.status} />
      </div>
      <h3 className={`font-display mt-3 leading-[0.95] ${large ? "text-[clamp(2rem,1.4rem+2vw,3.5rem)]" : "text-card"}`}>{story.title}</h3>
      <p className={`mt-3 max-w-xl ${muted}`}>{story.excerpt}</p>
    </Link>
  );
}
