"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The hero's opening: the photograph settles from a slow zoom while the
 * headline rises line by line, then the image drifts as the page scrolls away.
 * Elements start visible in the HTML and are only hidden by this effect, so a
 * slow script never leaves the first viewport blank.
 */
export function HeroMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        tl.fromTo("[data-hero-media]", { scale: 1.12 }, { scale: 1, duration: 2.6, ease: "power2.out" }, 0)
          .fromTo("[data-hero-line]", { yPercent: 105 }, { yPercent: 0, duration: 1.3, stagger: 0.12 }, 0.2)
          .fromTo("[data-hero-fade]", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.55);

        gsap.to("[data-hero-media]", {
          yPercent: 10,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to("[data-hero-content]", {
          opacity: 0.2,
          yPercent: -6,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "30% top", end: "bottom top", scrub: true },
        });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
