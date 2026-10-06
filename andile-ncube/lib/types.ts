/**
 * Content models. Every file in /data conforms to these, so a CMS can replace
 * the static modules later without touching components: map the CMS response
 * onto these shapes and nothing downstream changes.
 *
 * `status: "placeholder"` marks content that exists only to show the layout.
 * Components label it as such on the page — it is never presented as real.
 */

export type MediaId =
  | "IMG_6889"
  | "IMG_6890"
  | "IMG_6891"
  | "IMG_6892"
  | "IMG_6893"
  | "IMG_6894"
  | "IMG_6895"
  | "IMG_6896"
  | "IMG_6897"
  | "IMG_6898"
  | "IMG_6899"
  | "IMG_6900"
  | "IMG_6901"
  | "IMG_6902"
  | "IMG_6903";

export type MediaAsset = {
  id: MediaId;
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Where the brief places the image, kept for editors. */
  role: string;
  /** CSS object-position that keeps the subject in frame when cropped. */
  focus: string;
};

export type ContentStatus = "placeholder" | "draft" | "published";

export type Episode = {
  slug: string;
  number: number;
  title: string | null;
  status: ContentStatus;
  summary: string;
  poster: MediaId;
  /** Null until a cut is delivered. */
  video: { src: string; captions?: string; durationSeconds?: number } | null;
  releaseDate: string | null;
  behindTheBuild: string;
  keyMoments: { label: string; timestamp: string | null }[];
  shorts: { title: string | null; image: MediaId }[];
  related: string[];
};

export type FormatStatus = "concept" | "in-development" | "pilot" | "live";

export type Format = {
  slug: string;
  territory: string;
  /** Null until a format name is approved. The brief forbids inventing one. */
  name: string | null;
  status: FormatStatus;
  message: string;
  description: string;
  themes: string[];
  images: MediaId[];
};

export type SponsorCategory = {
  slug: string;
  name: string;
  role: string;
  summary: string;
  whyItFits: string;
  whereItAppears: string[];
  contentOpportunities: string[];
  inventory: string[];
  images: MediaId[];
};

/** Confirmed partners only. Empty until the client supplies them. */
export type Partner = {
  name: string;
  category: SponsorCategory["slug"];
  logo: string | null;
  url: string | null;
};

export type StoryCategory =
  | "The House"
  | "Sport"
  | "Culture"
  | "Lifestyle"
  | "People"
  | "Building"
  | "Media";

export type Story = {
  slug: string;
  title: string;
  category: StoryCategory;
  excerpt: string;
  body: string[];
  cover: MediaId;
  status: ContentStatus;
  publishedAt: string | null;
};

export type Download = {
  id: string;
  label: string;
  description: string;
  /** Null when the file has not been supplied yet. */
  href: string | null;
  format: string;
};
