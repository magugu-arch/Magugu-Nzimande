"use client";

import Image from "next/image";
import { useRef } from "react";
import { getMedia } from "@/data/media";
import { track } from "@/lib/analytics";
import type { Episode } from "@/lib/types";

/**
 * Native <video>: inline playback and system controls on phones, captions
 * via <track> when supplied. Until a cut exists the poster stands in with a
 * plain statement that the episode is not published — no fake play button.
 */
export function EpisodePlayer({ episode }: { episode: Episode }) {
  const started = useRef(false);
  const poster = getMedia(episode.poster);

  if (!episode.video) {
    return (
      <figure className="relative aspect-video overflow-hidden bg-charcoal">
        <Image src={poster.src} alt={poster.alt} fill preload sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover opacity-60" style={{ objectPosition: poster.focus }} />
        <figcaption className="absolute inset-0 flex items-end bg-linear-to-t from-ink/90 to-transparent p-6">
          <span>
            <span className="meta block text-stone">Not yet published</span>
            <span className="mt-2 block max-w-sm text-[0.95rem] text-ash">Video will play here when the episode is released.</span>
          </span>
        </figcaption>
      </figure>
    );
  }

  return (
    <video
      className="aspect-video w-full bg-ink"
      controls
      playsInline
      preload="metadata"
      poster={poster.src}
      onPlay={() => {
        if (started.current) return;
        started.current = true;
        track("episode_start", { episode: episode.slug });
      }}
      onEnded={() => track("episode_complete", { episode: episode.slug })}
    >
      <source src={episode.video.src} />
      {episode.video.captions && <track kind="captions" src={episode.video.captions} srcLang="en" label="English" default />}
    </video>
  );
}
