import type { ReactNode } from "react";
import type { MediaId } from "@/lib/types";
import { Lines } from "./Lines";
import { Media } from "./Media";
import { Motion } from "./Motion";
import { Eyebrow } from "./ui";

/** A large photograph beside a short block of editorial copy. */
export function ImageFeature({
  eyebrow,
  title,
  image,
  focus,
  reverse = false,
  tone = "light",
  children,
}: {
  eyebrow: string;
  title: string[];
  image: MediaId;
  focus?: string;
  reverse?: boolean;
  tone?: "light" | "dark" | "stone";
  children: ReactNode;
}) {
  const theme =
    tone === "dark" ? "theme-dark bg-ink text-paper" : tone === "stone" ? "theme-light bg-stone text-ink" : "theme-light bg-paper text-ink";
  const muted = tone === "dark" ? "text-ash" : "text-smoke";
  return (
    <section className={`${theme} py-24 md:py-32`}>
      <Motion className="container-site grid items-center gap-12 lg:grid-cols-12">
        <div className={`lg:col-span-7 ${reverse ? "lg:order-2" : ""}`} data-clip="">
          <Media id={image} sizes="(min-width: 1024px) 58vw, 100vw" className="aspect-[16/11]" focus={focus} motion="scale" />
        </div>
        <div className={`lg:col-span-5 ${reverse ? "lg:order-1" : ""}`}>
          <Eyebrow className={muted}>{eyebrow}</Eyebrow>
          <Lines className="font-display mt-6 text-[clamp(2rem,1.3rem+2.6vw,4rem)] leading-[0.92]" lines={title} />
          <div className={`mt-6 grid gap-4 ${muted}`} data-reveal="">
            {children}
          </div>
        </div>
      </Motion>
    </section>
  );
}
