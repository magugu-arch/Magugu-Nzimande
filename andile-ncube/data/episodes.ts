import type { Episode, MediaId } from "@/lib/types";

/**
 * Placeholder episodes. No titles, dates, runtimes or video were supplied, so
 * none are shown: each card is labelled as a placeholder on the page. Replace
 * this module (or its CMS source) with real episodes and set `status` to
 * "published" — the layout, routes and schema.org output follow automatically.
 */
const posters: MediaId[] = ["IMG_6905", "IMG_6898", "IMG_6894", "IMG_6907"];

export const episodes: Episode[] = posters.map((poster, i) => {
  const number = i + 1;
  const slug = `episode-${String(number).padStart(2, "0")}`;
  return {
    slug,
    number,
    title: null,
    status: "placeholder",
    summary:
      "Episode details will appear here once the edit is approved. This card shows the layout only.",
    poster,
    video: null,
    releaseDate: null,
    behindTheBuild:
      "Production notes, the people on site and the decisions behind this episode will be published with it.",
    keyMoments: [
      { label: "Key moment", timestamp: null },
      { label: "Key moment", timestamp: null },
      { label: "Key moment", timestamp: null },
    ],
    shorts: [
      { title: null, image: "IMG_6894" },
      { title: null, image: "IMG_6895" },
      { title: null, image: "IMG_6898" },
    ],
    related: [],
  };
});

export const getEpisode = (slug: string) => episodes.find((e) => e.slug === slug);

export const episodeLabel = (e: Episode) => `Episode ${String(e.number).padStart(2, "0")}`;

/** The short-form multiplier rail: one hero episode feeding many outputs. */
export const multiplierItems: {
  kind: "Hero episode" | "Short clip" | "Vertical edit" | "Milestone";
  image: MediaId;
  orientation: "landscape" | "portrait";
}[] = [
  { kind: "Hero episode", image: "IMG_6905", orientation: "landscape" },
  { kind: "Short clip", image: "IMG_6898", orientation: "landscape" },
  { kind: "Vertical edit", image: "IMG_6894", orientation: "portrait" },
  { kind: "Vertical edit", image: "IMG_6910", orientation: "portrait" },
  { kind: "Short clip", image: "IMG_6907", orientation: "landscape" },
  { kind: "Milestone", image: "IMG_6897", orientation: "landscape" },
  { kind: "Vertical edit", image: "IMG_6901", orientation: "portrait" },
];
