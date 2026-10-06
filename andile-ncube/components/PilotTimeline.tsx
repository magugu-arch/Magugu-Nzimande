"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { pilotPhases } from "@/data/site";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The 90-day proving period as a vertical, scroll-driven timeline: the rail
 * fills as you read down it and each phase brightens when it reaches the
 * centre of the screen. With reduced motion everything is simply shown.
 */
export function PilotTimeline() {
  const ref = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-pilot-fill]",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: ref.current, start: "top 65%", end: "bottom 65%", scrub: 0.4 },
          },
        );
        for (const phase of gsap.utils.toArray<HTMLElement>("[data-pilot-phase]")) {
          gsap.fromTo(
            phase,
            { opacity: 0.6 },
            {
              opacity: 1,
              ease: "none",
              scrollTrigger: { trigger: phase, start: "top 80%", end: "top 50%", scrub: true },
            },
          );
        }
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <ol ref={ref} className="relative">
      <span aria-hidden="true" className="absolute bottom-0 left-[0.4375rem] top-2 w-px bg-paper/15" />
      <span
        aria-hidden="true"
        data-pilot-fill=""
        className="absolute bottom-0 left-[0.4375rem] top-2 w-px origin-top bg-brass"
      />
      {pilotPhases.map((phase, i) => (
        <li key={phase.days} data-pilot-phase="" className="relative pb-16 pl-10 last:pb-0 md:pb-24 md:pl-16">
          <span aria-hidden="true" className="absolute left-0 top-2 size-[0.9375rem] rounded-full border border-brass bg-charcoal" />
          <p className="meta text-brass">{phase.days}</p>
          <h3 className="font-display mt-3 text-[clamp(2.25rem,1.5rem+3vw,4.5rem)] leading-[0.9]">
            <span className="sr-only">Phase {i + 1}: </span>
            {phase.title}
          </h3>
          <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {phase.items.map((item) => (
              <li key={item} className="flex gap-3 border-t border-paper/15 pt-3 text-stone">
                {item}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
