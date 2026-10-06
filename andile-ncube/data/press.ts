import type { Download, MediaId } from "@/lib/types";

/** Suggested opening from the brief — subject to approval, and labelled so on the page. */
export const biography = {
  status: "draft" as const,
  paragraphs: [
    "Andile Ncube has spent years in front of cameras and around major moments in sport and entertainment. The next move is different: build the platform rather than simply appear on it.",
  ],
};

export const showInformation = {
  title: "The House That Andile Built",
  body: "A flagship series following the build — vision, foundation, build, reveal and ownership — produced on a weekly cadence with a cinematic long-form edit and a short-form multiplier. LegacyLeverage is the production and commercial engine; Andile owns the show, the audience and the IP.",
};

export const headshots: MediaId[] = ["IMG_6891", "IMG_6899", "IMG_6889"];

export const pressPhotographs: MediaId[] = [
  "IMG_6893",
  "IMG_6894",
  "IMG_6897",
  "IMG_6898",
  "IMG_6901",
  "IMG_6903",
];

/** Files not yet supplied have `href: null` and render as "on request". */
export const pressDownloads: Download[] = [
  {
    id: "press-biography",
    label: "Biography",
    description: "Approved short and long biography.",
    href: null,
    format: "PDF",
  },
  {
    id: "press-show-sheet",
    label: "Show information",
    description: "One-page overview of The House That Andile Built.",
    href: null,
    format: "PDF",
  },
];
