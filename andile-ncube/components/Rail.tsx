"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A horizontal media rail: native scroll with snap points, so it swipes on
 * touch, scrolls with a trackpad, and is reachable by keyboard. Arrow buttons
 * page through it for mouse users.
 */
export function Rail({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={className}>
      <div className="container-site mb-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={edges.start}
          aria-label={`Previous — ${label}`}
          className="inline-flex size-12 items-center justify-center border border-current/30 transition-opacity hover:border-current disabled:opacity-30"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          disabled={edges.end}
          aria-label={`Next — ${label}`}
          className="inline-flex size-12 items-center justify-center border border-current/30 transition-opacity hover:border-current disabled:opacity-30"
        >
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </button>
      </div>
      <ul
        ref={track}
        onScroll={measure}
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:scroll-px-10 md:gap-6 md:px-10 xl:scroll-px-16 xl:px-16"
      >
        {children}
      </ul>
    </div>
  );
}
