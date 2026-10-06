/**
 * Options for the partnership enquiry flow. Shared by the client form and the
 * server validator, so the two can never disagree about what is allowed.
 */

export const opportunities = [
  { value: "sponsor-flagship", label: "Sponsor the Flagship" },
  { value: "present-format", label: "Present a Format" },
  { value: "brand-integration", label: "Brand Integration" },
  { value: "co-production", label: "Co-production" },
  { value: "media-partnership", label: "Media Partnership" },
  { value: "other", label: "Other" },
] as const;

/** Ranges are form choices for qualification only, not a rate card. Edit freely. */
export const budgetRanges = [
  { value: "tbd", label: "To be discussed" },
  { value: "under-250k", label: "Under R250,000" },
  { value: "250k-500k", label: "R250,000 – R500,000" },
  { value: "500k-1m", label: "R500,000 – R1 million" },
  { value: "1m-plus", label: "R1 million +" },
] as const;

export const objectives = [
  { value: "awareness", label: "Brand awareness" },
  { value: "integration", label: "Product integration" },
  { value: "audience", label: "Audience and community" },
  { value: "content", label: "Content co-creation" },
  { value: "leads", label: "Sales and lead generation" },
  { value: "other", label: "Something else" },
] as const;

export const upload = {
  maxBytes: 10 * 1024 * 1024,
  extensions: [".pdf", ".docx", ".pptx"],
  accept:
    ".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export type OpportunityValue = (typeof opportunities)[number]["value"];
export type BudgetValue = (typeof budgetRanges)[number]["value"];
export type ObjectiveValue = (typeof objectives)[number]["value"];
