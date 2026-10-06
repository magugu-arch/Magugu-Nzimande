"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Scroll motion for everything inside it, driven by data attributes so the
 * content itself can stay in server components:
 *
 * - `[data-lines]` containing `[data-line]` — masked line reveal
 * - `[data-reveal]` — fade and rise
 * - `[data-clip]` — image wipes up into frame (chapter transitions)
 * - `[data-scale]` — image settles from a slight zoom as it scrolls through
 * - `[data-parallax]` — image drifts against the scroll
 *
 * Nothing runs for people who prefer reduced motion; the CSS that pre-hides
 * these elements is gated on the same media query, so they simply show.
 */
export function Motion({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const root = ref.current;
        if (!root) return;
        const q = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));

        for (const group of q("[data-lines]")) {
          gsap.fromTo(
            group.querySelectorAll("[data-line]"),
            { y: 0, yPercent: 105 },
            {
              y: 0,
              yPercent: 0,
              duration: 1.1,
              ease: "expo.out",
              stagger: 0.09,
              scrollTrigger: { trigger: group, start: "top 90%", once: true },
            },
          );
        }

        ScrollTrigger.batch(q("[data-reveal]"), {
          start: "top 92%",
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(
              batch,
              { opacity: 0, y: 28 },
              { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 },
            ),
        });

        for (const el of q("[data-clip]")) {
          gsap.fromTo(
            el,
            { clipPath: "inset(18% 0% 0% 0%)" },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              ease: "none",
              scrollTrigger: { trigger: el, start: "top 95%", end: "top 45%", scrub: 0.6 },
            },
          );
        }

        for (const el of q("[data-scale]")) {
          gsap.fromTo(
            el,
            { scale: 1.14 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        }

        for (const el of q("[data-parallax]")) {
          gsap.fromTo(
            el,
            { yPercent: -6, scale: 1.14 },
            {
              yPercent: 6,
              scale: 1.14,
              ease: "none",
              scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        }
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
