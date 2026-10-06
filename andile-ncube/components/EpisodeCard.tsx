import { Play } from "lucide-react";
import { episodeLabel } from "@/data/episodes";
import type { Episode } from "@/lib/types";
import { Media } from "./Media";
import { TrackedLink } from "./TrackedLink";
import { PendingTag } from "./ui";

export function EpisodeCard({ episode, sizes }: { episode: Episode; sizes: string }) {
  return (
    <TrackedLink
      href={`/flagship/${episode.slug}`}
      event="watch_click"
      eventProps={{ episode: episode.slug, source: "episode_card" }}
      className="group block"
    >
      <div className="relative">
        <Media
          id={episode.poster}
          sizes={sizes}
          className="aspect-video"
          imgClassName="transition-transform duration-[1.2s] ease-[var(--ease-cinematic)] group-hover:scale-[1.04]"
          decorative
        />
        <span
          aria-hidden="true"
          className="absolute bottom-4 left-4 inline-flex size-12 items-center justify-center bg-paper/90 text-ink transition-colors group-hover:bg-paper"
        >
          <Play className="size-4" strokeWidth={1.5} />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="meta text-ash">{episodeLabel(episode)}</p>
        <PendingTag status={episode.status} />
      </div>
      <h3 className="font-display mt-2 text-[1.5rem] leading-none">{episode.title ?? "Title to be confirmed"}</h3>
    </TrackedLink>
  );
}
