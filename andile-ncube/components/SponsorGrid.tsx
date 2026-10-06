"use client";

import { ArrowRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { getMedia } from "@/data/media";
import { track } from "@/lib/analytics";
import type { SponsorCategory } from "@/lib/types";

const enquireHref = (slug: string) => `/partners?opportunity=sponsor-flagship&category=${slug}#enquire`;

function Details({ category, tone }: { category: SponsorCategory; tone: "dark" | "light" }) {
  const muted = tone === "dark" ? "text-ash" : "text-smoke";
  const blocks = [
    { label: "Where it appears", items: category.whereItAppears },
    { label: "Content opportunities", items: category.contentOpportunities },
    { label: "Inventory", items: category.inventory },
  ];
  return (
    <div>
      <h4 className={`meta ${muted}`}>Why it fits</h4>
      <p className="mt-3 text-[1.05rem] leading-relaxed">{category.whyItFits}</p>
      <div className={`mt-8 grid gap-8 ${tone === "dark" ? "grid-cols-3" : ""}`}>
        {blocks.map((b) => (
          <div key={b.label}>
            <h4 className={`meta ${muted}`}>{b.label}</h4>
            <ul className="mt-3 space-y-2 text-[0.95rem] leading-snug">
              {b.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className={`mt-[0.6em] h-px w-3 shrink-0 bg-current ${muted}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className={`mt-6 text-[0.85rem] ${muted}`}>Proposed structure. Final inventory and terms are set in the rate card.</p>
      <Link
        href={enquireHref(category.slug)}
        onClick={() => track("partnership_start", { source: "sponsor_card", category: category.slug })}
        className={`group mt-8 inline-flex min-h-12 items-center gap-3 px-6 meta transition-colors ${
          tone === "dark" ? "bg-paper text-ink hover:bg-stone" : "bg-ink text-paper hover:bg-charcoal"
        }`}
      >
        Enquire — {category.name}
        <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
      </Link>
    </div>
  );
}

/**
 * The five sponsor categories. Wide screens get a tab list and a detail
 * panel; phones get swipeable cards that each expand in place.
 */
export function SponsorGrid({ categories }: { categories: SponsorCategory[] }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const viewed = useRef(new Set<string>());

  const view = (slug: string, layout: string) => {
    if (viewed.current.has(slug)) return;
    viewed.current.add(slug);
    track("sponsor_category_view", { category: slug, layout });
  };

  useEffect(() => {
    // The first tab is visible by default on wide screens; count it as viewed there.
    if (window.matchMedia("(min-width: 1024px)").matches) view(categories[0]!.slug, "tabs");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (i: number) => {
    setActive(i);
    view(categories[i]!.slug, "tabs");
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = categories.length - 1;
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  };

  const current = categories[active]!;
  const currentImage = getMedia(current.images[0]!);

  return (
    <>
      {/* Wide screens: tabs + panel */}
      <div className="hidden gap-10 lg:grid lg:grid-cols-12">
        <div role="tablist" aria-orientation="vertical" aria-label="Sponsor categories" className="lg:col-span-4">
          {categories.map((c, i) => (
            <button
              key={c.slug}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`${id}-tab-${c.slug}`}
              aria-selected={i === active}
              aria-controls={`${id}-panel`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={`group flex w-full items-baseline gap-5 border-t border-paper/15 py-6 text-left transition-colors last:border-b ${
                i === active ? "text-paper" : "text-paper/60 hover:text-paper/85"
              }`}
            >
              <span className="meta w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="font-display block text-[clamp(1.5rem,1rem+1.2vw,2.25rem)] leading-none">{c.name}</span>
                <span className="meta mt-2 block">{c.role}</span>
              </span>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${current.slug}`}
          tabIndex={0}
          className="grid grid-cols-8 gap-8 lg:col-span-8"
        >
          <div className="relative col-span-3 aspect-[3/4] overflow-hidden bg-charcoal">
            <Image
              key={currentImage.id}
              src={currentImage.src}
              alt={currentImage.alt}
              fill
              sizes="22vw"
              className="animate-[fade_0.8s_ease-out] object-cover"
              style={{ objectPosition: currentImage.focus }}
            />
          </div>
          <div className="col-span-5">
            <p className="meta text-brass">{current.role}</p>
            <h3 className="font-display mt-3 text-[clamp(2rem,1.4rem+1.6vw,3.25rem)] leading-[0.95]">{current.name}</h3>
            <p className="mt-3 font-serif text-[1.35rem] italic text-stone">{current.summary}</p>
            <div className="mt-8">
              <Details category={current} tone="dark" />
            </div>
          </div>
        </div>
      </div>

      {/* Phones and tablets: swipeable cards */}
      <ul
        aria-label="Sponsor categories"
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-4 overflow-x-auto px-4 pb-2 md:-mx-10 md:scroll-px-10 md:px-10 lg:hidden"
      >
        {categories.map((c, i) => {
          const image = getMedia(c.images[0]!);
          const expanded = open === c.slug;
          return (
            <li key={c.slug} className="w-[86%] shrink-0 snap-start bg-paper text-ink sm:w-[60%]">
              <div className="relative aspect-[4/3] overflow-hidden bg-charcoal">
                <Image src={image.src} alt={image.alt} fill sizes="(min-width: 640px) 60vw, 86vw" className="object-cover" style={{ objectPosition: image.focus }} />
                <span className="meta absolute left-4 top-4 bg-ink px-2 py-1 text-paper">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="theme-light p-5">
                <p className="meta text-smoke">{c.role}</p>
                <h3 className="font-display mt-2 text-card">{c.name}</h3>
                <p className="mt-2 font-serif text-[1.2rem] italic">{c.summary}</p>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`${id}-card-${c.slug}`}
                  onClick={() => {
                    setOpen(expanded ? null : c.slug);
                    if (!expanded) view(c.slug, "cards");
                  }}
                  className="meta mt-4 inline-flex min-h-11 items-center gap-2 border-b border-ink/30"
                >
                  {expanded ? "Hide details" : "Why it fits, inventory & more"}
                  <Plus aria-hidden="true" className={`size-4 transition-transform ${expanded ? "rotate-45" : ""}`} strokeWidth={1.5} />
                </button>
                <div id={`${id}-card-${c.slug}`} hidden={!expanded} className="mt-6">
                  <Details category={c} tone="light" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
