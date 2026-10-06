import { ArrowUpRight } from "lucide-react";
import type { Format } from "@/lib/types";
import { Media } from "./Media";
import { TrackedLink } from "./TrackedLink";
import { StatusChip } from "./ui";

export function FormatCard({ format, href }: { format: Format; href: string }) {
  const image = format.images[0];
  return (
    <TrackedLink
      href={href}
      event="slate_click"
      eventProps={{ format: format.slug }}
      className="group flex h-full flex-col border-t border-ink/20 pt-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="meta">{format.territory}</p>
        <StatusChip status={format.status} />
      </div>
      {image ? (
        <Media
          id={image}
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
          className="mt-5 aspect-[4/5]"
          imgClassName="transition-transform duration-[1.2s] ease-[var(--ease-cinematic)] group-hover:scale-[1.04]"
        />
      ) : (
        // No approved imagery for this territory: type only, by design.
        <div className="mt-5 flex aspect-[4/5] items-end bg-ink p-6 text-paper">
          <p className="font-display text-[clamp(2.5rem,2rem+2vw,4rem)] leading-[0.9] text-stone">{format.territory}</p>
        </div>
      )}
      <h3 className="font-display mt-6 text-card">{format.name ?? `${format.territory} format`}</h3>
      {!format.name && <p className="meta mt-2 text-smoke">Name to be confirmed</p>}
      <p className="mt-4 font-serif text-[1.35rem] leading-snug italic">{format.message}</p>
      <span className="meta mt-auto inline-flex min-h-11 items-center gap-2 pt-6">
        Explore
        <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
      </span>
    </TrackedLink>
  );
}
