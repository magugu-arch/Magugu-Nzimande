import type { Download, MediaId } from "@/lib/types";

/**
 * Site-wide copy and configuration. Copy comes from the master brief; where
 * the brief marks something as subject to approval, it says so here too.
 */

export const site = {
  name: "Andile Ncube",
  property: "The House That Andile Built",
  tagline: "A broadcaster building something he owns.",
  description:
    "Andile Ncube — broadcaster, host and storyteller — and The House That Andile Built: an owned media property, a format slate and a sponsor engine built around the category.",
  /** Set NEXT_PUBLIC_SITE_URL in production. The fallback is for local builds only. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  disciplines: ["Media", "Culture", "Sport", "Lifestyle"],
  engine: "LegacyLeverage",
} as const;

export const ctas = {
  partner: { label: "Partner with Andile", href: "/partners#enquire" },
  watch: { label: "Watch the Flagship", href: "/flagship#episodes" },
  slate: { label: "Explore the Slate", href: "/slate" },
  deck: { label: "Download Partnership Deck", href: "/partners#deck" },
  enter: { label: "Enter the House", href: "/house" },
  call: { label: "Request a Partnership Call", href: "/partners?opportunity=other#enquire" },
  pilot: { label: "Start the Pilot", href: "/partners?opportunity=sponsor-flagship#enquire" },
} as const;

export type NavItem = { label: string; href: string };

export const desktopNav: NavItem[] = [
  { label: "The House", href: "/house" },
  { label: "Flagship", href: "/flagship" },
  { label: "Slate", href: "/slate" },
  { label: "Partners", href: "/partners" },
  { label: "Story", href: "/story" },
  { label: "Journal", href: "/journal" },
];

export const menuNav: NavItem[] = [
  { label: "The House", href: "/house" },
  { label: "The Flagship", href: "/flagship" },
  { label: "The Slate", href: "/slate" },
  { label: "Partners", href: "/partners" },
  { label: "The Story", href: "/story" },
  { label: "Journal", href: "/journal" },
  { label: "Press / Media", href: "/press" },
  { label: "Contact", href: "/partners#enquire" },
];

export const pillars = [
  {
    index: "01",
    title: "The Flagship",
    body: "Professionalise the build series into appointment viewing: a weekly cadence, a format structure, a cinematic edit and a short-form multiplier.",
    href: "/flagship",
  },
  {
    index: "02",
    title: "The Slate",
    body: "A portfolio of owned formats drawing on sport, lifestyle and fatherhood.",
    href: "/slate",
  },
  {
    index: "03",
    title: "The Sponsor Engine",
    body: "Structured, sellable brand inventory across five categories that already live inside the story.",
    href: "/partners",
  },
  {
    index: "04",
    title: "The Institution",
    body: "Build toward co-production and long-term owned IP.",
    href: "/partners#institution",
  },
] as const;

export type HouseStage = {
  id: string;
  label: string;
  heading: string;
  body: string;
  image: MediaId;
};

/**
 * The visual build story. Stage completion is deliberately not stated: the
 * brief forbids calling any stage complete without supplied confirmation.
 */
export const houseStages: HouseStage[] = [
  {
    id: "vision",
    label: "Vision",
    heading: "It starts as an idea on paper.",
    body: "Plans, references and the decision to build something that belongs to him — on camera, from the first sketch.",
    image: "IMG_6166",
  },
  {
    id: "foundation",
    label: "Foundation",
    heading: "Materials, choices, consequences.",
    body: "Every material, fitting and trade decision is a scene. The category partners live here, inside the work rather than beside it.",
    image: "IMG_6160",
  },
  {
    id: "build",
    label: "Build",
    heading: "Transparent, on site, in progress.",
    body: "The build is shown as it happens — the people, the problems and the fixes — so the audience earns the reveal with him.",
    image: "IMG_6894",
  },
  {
    id: "reveal",
    label: "Reveal",
    heading: "The moment the audience has been waiting for.",
    body: "Milestones become appointment viewing. The reveal is the payoff the weekly cadence builds toward.",
    image: "IMG_6897",
  },
  {
    id: "ownership",
    label: "Ownership",
    heading: "The house, the show, the audience.",
    body: "What is built stays built. The series, the audience relationship and the IP are his to keep and extend.",
    image: "IMG_6161",
  },
];

export const flagshipFormat = [
  {
    title: "Weekly production cadence",
    body: "A fixed weekly release rhythm so the build becomes appointment viewing rather than occasional posting.",
  },
  {
    title: "Format bible",
    body: "One document that fixes the structure, tone, segments and rules of the show, so every episode is recognisably the same series.",
  },
  {
    title: "Recurring segments",
    body: "Repeatable segments the audience learns to expect — and that partners can attach to without interrupting the story.",
  },
  {
    title: "Milestones",
    body: "Build milestones mark the season's shape and give the series natural moments to promote, sponsor and celebrate.",
  },
  {
    title: "Human subplots",
    body: "The people around the build — trades, advisers, family where approved — carry the story between milestones.",
  },
  {
    title: "Cinematic edit",
    body: "Long-form episodes cut with the care of broadcast television: considered pacing, grade and sound.",
  },
  {
    title: "Short-form multiplier",
    body: "Each shoot yields clips, vertical edits and milestone moments for every platform, multiplying reach from one production day.",
  },
] as const;

export const institutionPhases = [
  {
    phase: "Phase 1",
    title: "Flagship",
    body: "One show, professionally produced on a weekly cadence.",
  },
  {
    phase: "Phase 2",
    title: "Partners",
    body: "A structured partner programme across the five sponsor categories.",
  },
  {
    phase: "Phase 3",
    title: "New Formats",
    body: "The Slate: owned formats in sport, lifestyle and fatherhood.",
  },
  {
    phase: "Phase 4",
    title: "Co-production",
    body: "Co-production terms and long-term owned IP.",
  },
] as const;

export const pilotPhases = [
  {
    days: "Days 01–30",
    title: "Stabilise",
    items: [
      "Clear publishing backlog",
      "Set format bible",
      "Set calendar",
      "Launch short-form multiplier",
    ],
  },
  {
    days: "Days 31–60",
    title: "Package + Pitch",
    items: ["Sponsor deck / rate card", "Hardware anchor", "Finance / automotive outreach"],
  },
  {
    days: "Days 61–90",
    title: "Extend + Formalise",
    items: ["Pilot second format", "Shared scorecard", "Co-production terms"],
  },
] as const;

/**
 * The partnership deck. `href` is null until the client supplies the PDF; the
 * "Download" button then opens a short request form instead of a dead link.
 * Drop the file into /public/downloads and set the path here to switch to a
 * direct download.
 */
export const partnershipDeck: Download = {
  id: "partnership-deck",
  label: "Partnership Deck",
  description: "The Flagship, the Slate and the Sponsor Engine, with category inventory.",
  href: null,
  format: "PDF",
};

/** Media contact. Null until supplied — the press page says so rather than inventing one. */
export const mediaContact: { name: string; email: string } | null = null;
