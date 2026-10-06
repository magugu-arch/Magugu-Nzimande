"use client";

import { useState, type ReactNode } from "react";
import type { StoryCategory } from "@/lib/types";

/**
 * Category filter over server-rendered cards. Every story stays in the HTML
 * (crawlable); filtering only hides cards that do not match.
 */
export function JournalFilter({
  categories,
  items,
  featured = [],
}: {
  categories: StoryCategory[];
  items: { slug: string; category: StoryCategory; node: ReactNode }[];
  /** Slugs already shown above the grid; hidden from it until a filter is chosen. */
  featured?: string[];
}) {
  const [active, setActive] = useState<StoryCategory | "All">("All");
  const visible = items.filter((i) => (active === "All" ? !featured.includes(i.slug) : i.category === active));

  return (
    <>
      <div role="group" aria-label="Filter stories by category" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {(["All", ...categories] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={active === c}
            onClick={() => setActive(c)}
            className={`meta min-h-11 shrink-0 border px-4 transition-colors ${
              active === c ? "border-ink bg-ink text-paper" : "border-ink/25 hover:border-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "story" : "stories"} shown
      </p>
      {visible.length === 0 && active !== "All" ? (
        <p className="mt-16 max-w-md text-smoke">No stories in {active} yet. They will appear here once approved.</p>
      ) : (
        <ul className="mt-12 grid gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <li key={i.slug} hidden={!visible.includes(i)}>
              {i.node}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
