"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getMedia } from "@/data/media";
import type { HouseStage } from "@/data/site";

/**
 * VISION → FOUNDATION → BUILD → REVEAL → OWNERSHIP as a pinned narrative: on
 * wide screens the photograph holds still while the stages scroll past it and
 * crossfade in turn. On phones each stage carries its own image inline.
 *
 * Uses CSS `position: sticky` and an IntersectionObserver rather than a JS pin,
 * so it costs nothing on scroll and works identically with reduced motion.
 */
export function HouseTimeline({ stages }: { stages: HouseStage[] }) {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="hidden lg:col-span-7 lg:block">
        <div className="sticky top-[calc(var(--header-h)+2rem)] aspect-[4/3] overflow-hidden bg-charcoal">
          <div className="absolute inset-0">
          {stages.map((stage, i) => {
            const asset = getMedia(stage.image);
            return (
              <Image
                key={stage.id}
                src={asset.src}
                alt={i === active ? asset.alt : ""}
                aria-hidden={i !== active}
                fill
                sizes="(min-width: 1024px) 55vw, 1px"
                className={`object-cover transition-[opacity,scale] duration-1000 ease-[var(--ease-cinematic)] ${
                  i === active ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
                }`}
                style={{ objectPosition: asset.focus }}
              />
            );
          })}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex gap-1 p-4" aria-hidden="true">
            {stages.map((s, i) => (
              <span key={s.id} className={`h-0.5 flex-1 transition-colors duration-500 ${i <= active ? "bg-paper" : "bg-paper/30"}`} />
            ))}
          </div>
        </div>
      </div>

      <ol className="lg:col-span-5">
        {stages.map((stage, i) => {
          const asset = getMedia(stage.image);
          return (
            <li
              key={stage.id}
              ref={(el) => {
                items.current[i] = el;
              }}
              data-index={i}
              className="border-t border-ink/15 py-10 lg:flex lg:min-h-[70vh] lg:flex-col lg:justify-center lg:py-16"
            >
              <div className="relative mb-6 aspect-[3/2] overflow-hidden bg-stone lg:hidden">
                <Image
                  src={asset.src}
                  alt={asset.alt}
                  fill
                  sizes="(min-width: 1024px) 1px, 100vw"
                  className="object-cover"
                  style={{ objectPosition: asset.focus }}
                />
              </div>
              <p className="meta flex items-center gap-3 text-smoke">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <span aria-hidden="true" className="h-px w-6 bg-current" />
                <span>{stage.label}</span>
              </p>
              <h3
                className={`font-display mt-4 text-card transition-opacity duration-500 lg:text-[clamp(2rem,1.4rem+1.6vw,3.25rem)] ${
                  i === active ? "lg:opacity-100" : "lg:opacity-50"
                }`}
              >
                {stage.heading}
              </h3>
              <p className="mt-4 max-w-md text-smoke">{stage.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
