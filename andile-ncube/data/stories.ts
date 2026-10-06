import type { Story, StoryCategory } from "@/lib/types";

export const storyCategories: StoryCategory[] = [
  "The House",
  "Sport",
  "Culture",
  "Lifestyle",
  "People",
  "Building",
  "Media",
];

/**
 * Draft journal entries. Each one restates the strategy in editorial form and
 * contains no facts beyond it. They are marked "draft" on the page until the
 * client approves or replaces them; categories with nothing approved stay empty.
 */
export const stories: Story[] = [
  {
    slug: "broadcaster-to-owner",
    title: "Broadcaster → Owner",
    category: "Media",
    excerpt:
      "For years the audience belonged to someone else's channel. The House That Andile Built changes who owns the show.",
    body: [
      "A broadcaster builds audiences for a living. The question this platform asks is simple: whose audience is it when the broadcast ends?",
      "The House That Andile Built is the answer in practice — a series he owns, about something he is building, released on a schedule he sets.",
      "LegacyLeverage provides the production and commercial engine. The show, the audience and the IP stay with Andile.",
    ],
    cover: "IMG_6899",
    status: "draft",
    publishedAt: null,
  },
  {
    slug: "why-the-build-is-the-show",
    title: "Why the build is the show",
    category: "The House",
    excerpt:
      "A house is the rare story with a built-in season arc: vision, foundation, build, reveal and ownership.",
    body: [
      "Most series have to invent their structure. A build arrives with one: every house moves from vision to foundation, from build to reveal.",
      "That structure gives the flagship its milestones, its weekly cadence and its payoff — and gives partners natural places inside the story.",
    ],
    cover: "IMG_6897",
    status: "draft",
    publishedAt: null,
  },
  {
    slug: "one-shoot-many-stories",
    title: "One shoot. Many stories.",
    category: "Media",
    excerpt:
      "How a single production day becomes a long-form episode, short clips, vertical edits and milestone moments.",
    body: [
      "The short-form multiplier is a production discipline: plan every shoot for the long-form episode and for everything cut from it.",
      "One day on site can feed the flagship, the clips, the vertical edits and the milestone posts that bring new viewers back to the series.",
    ],
    cover: "IMG_6905",
    status: "draft",
    publishedAt: null,
  },
  {
    slug: "build-the-story-around-the-category",
    title: "Build the story around the category",
    category: "Building",
    excerpt:
      "Why the Sponsor Engine starts with what the build genuinely needs, not with where a logo can go.",
    body: [
      "A logo placed in a story is easy to ignore. A category that the story depends on is not.",
      "The Sponsor Engine is organised around five categories the build already needs — materials and hardware, home finance, automotive, home tech and security, insurance and services.",
    ],
    cover: "IMG_6895",
    status: "draft",
    publishedAt: null,
  },
  {
    slug: "the-ninety-day-proving-period",
    title: "The 90-day proving period",
    category: "Building",
    excerpt: "Stabilise, package and pitch, then extend and formalise — three phases of thirty days.",
    body: [
      "Days 1–30 stabilise the flagship: clear the backlog, set the format bible and calendar, and launch short-form.",
      "Days 31–60 package and pitch: the sponsor deck and rate card, the hardware anchor, and outreach to finance and automotive.",
      "Days 61–90 extend and formalise: pilot a second owned format, report on a shared scorecard, and formalise co-production terms.",
    ],
    cover: "IMG_6906",
    status: "draft",
    publishedAt: null,
  },
];

export const getStory = (slug: string) => stories.find((s) => s.slug === slug);

export const categorySlug = (c: StoryCategory) => c.toLowerCase().replace(/\s+/g, "-");
