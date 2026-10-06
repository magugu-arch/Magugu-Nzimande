import type { Partner, SponsorCategory } from "@/lib/types";

/**
 * The five sponsor categories and partner roles from the strategy. Placement
 * and inventory lines describe proposed structure, not agreed deals; final
 * terms belong in the rate card.
 */
export const sponsorCategories: SponsorCategory[] = [
  {
    slug: "materials-hardware",
    name: "Materials & Hardware",
    role: "Anchor Partner",
    summary: "The category the build physically runs on.",
    whyItFits:
      "Every stage of the build depends on materials, tools and fittings. The category is already in every frame — the partnership makes it deliberate.",
    whereItAppears: [
      "Foundation and build episodes",
      "Material-selection scenes on site",
      "Series credits as anchor partner",
    ],
    contentOpportunities: [
      "Materials and method segments",
      "Choosing-the-finish decisions on camera",
      "Milestone moments tied to the build",
    ],
    inventory: [
      "Anchor partner credit across the series",
      "Integrated segment per episode",
      "Short-form cut-downs for partner channels",
    ],
    images: ["IMG_6894", "IMG_6895", "IMG_6898"],
  },
  {
    slug: "home-finance",
    name: "Home Finance",
    role: "Presenting Partner",
    summary: "How a house actually gets paid for.",
    whyItFits:
      "Owning a home starts with financing it. The series can make a hard subject watchable by showing real decisions at real stages.",
    whereItAppears: [
      "Vision and planning episodes",
      "Presenting credit on the series",
      "Explainer segments at key decisions",
    ],
    contentOpportunities: [
      "Plain-language finance explainers",
      "Planning and budgeting segments",
      "Ownership milestones",
    ],
    inventory: [
      "Presenting partner credit",
      "Explainer segments",
      "Companion short-form series",
    ],
    images: ["IMG_6890", "IMG_6897"],
  },
  {
    slug: "automotive",
    name: "Automotive",
    role: "Milestone Sponsor",
    summary: "Arrivals, site visits and the road between them.",
    whyItFits:
      "Every site visit and milestone involves getting there. Automotive fits the lifestyle around the build without interrupting it.",
    whereItAppears: [
      "Milestone episodes",
      "Arrivals and site visits",
      "Lifestyle content beyond the build",
    ],
    contentOpportunities: [
      "Milestone moment sponsorship",
      "Drive-and-talk segments",
      "Lifestyle territory crossovers",
    ],
    inventory: [
      "Milestone sponsorship",
      "In-content vehicle integration",
      "Vertical edits for partner channels",
    ],
    images: ["IMG_6896"],
  },
  {
    slug: "home-tech-security",
    name: "Home Tech & Security",
    role: "Feature Integration",
    summary: "The systems that make a house a home.",
    whyItFits:
      "Smart home and security decisions are made during the build. Showing them installed and used is integration, not placement.",
    whereItAppears: [
      "Fit-out and installation episodes",
      "Reveal and walkthrough content",
      "Feature segments",
    ],
    contentOpportunities: [
      "Install-and-explain features",
      "Reveal walkthroughs",
      "Living-with-it follow-ups",
    ],
    inventory: ["Feature integration", "Walkthrough segments", "Short-form demos"],
    images: ["IMG_6897", "IMG_6899"],
  },
  {
    slug: "insurance-services",
    name: "Insurance & Services",
    role: "Segment Sponsor",
    summary: "Protecting what has been built.",
    whyItFits:
      "Once something is built, it needs protecting and maintaining. The category belongs to the ownership chapter of the story.",
    whereItAppears: [
      "Ownership and reveal episodes",
      "A sponsored recurring segment",
      "Practical advice content",
    ],
    contentOpportunities: [
      "Sponsored recurring segment",
      "Practical homeowner advice",
      "Ownership-chapter storytelling",
    ],
    inventory: ["Segment sponsorship", "Advice series", "Short-form cut-downs"],
    images: ["IMG_6902", "IMG_6892"],
  },
];

export const getSponsorCategory = (slug: string) =>
  sponsorCategories.find((c) => c.slug === slug);

/** Confirmed partners. Intentionally empty: none have been supplied. */
export const partners: Partner[] = [];
