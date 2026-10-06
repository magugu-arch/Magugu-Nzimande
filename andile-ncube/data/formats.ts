import type { Format, FormatStatus } from "@/lib/types";

export const statusLabels: Record<FormatStatus, string> = {
  concept: "Concept",
  "in-development": "In development",
  pilot: "Pilot",
  live: "Live",
};

/**
 * The Slate. Format names are null because none have been approved — the brief
 * says not to invent them. Every territory is marked "concept" until the client
 * confirms otherwise; the strategy pilots a second format in days 61–90.
 */
export const formats: Format[] = [
  {
    slug: "sport",
    territory: "Sport",
    name: null,
    status: "concept",
    message: "Broadcast credibility becomes an owned sports conversation.",
    description:
      "Years around major sporting moments become a format he owns: the conversation, the access and the audience, on his own platform.",
    themes: ["Analysis", "Conversation", "Access", "Matchday culture"],
    images: ["IMG_6903"],
  },
  {
    slug: "lifestyle",
    territory: "Lifestyle",
    name: null,
    status: "concept",
    message: "The house opens onto everything that happens in it.",
    description:
      "A lifestyle territory that grows naturally from the flagship, with room for category partners beyond the build.",
    themes: ["Homes", "Design", "Cars", "Travel", "Culture", "Food", "Family"],
    images: ["IMG_6896", "IMG_6908", "IMG_6897"],
  },
  {
    slug: "fatherhood",
    territory: "Fatherhood",
    name: null,
    status: "concept",
    message: "A territory reserved for approved stories only.",
    description:
      "Fatherhood is part of the strategy's slate. No family details or imagery are shown until they are approved for publication.",
    themes: [],
    images: [],
  },
];
