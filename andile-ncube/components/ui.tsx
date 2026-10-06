import type { ReactNode } from "react";
import { statusLabels } from "@/data/formats";
import type { ContentStatus, FormatStatus } from "@/lib/types";

/** Shared class strings for links and buttons. 48px tall: above the 44px touch minimum. */
export const buttonClass = {
  solid:
    "group inline-flex min-h-12 items-center justify-center gap-3 bg-paper px-6 meta text-ink transition-colors duration-300 hover:bg-stone",
  solidDark:
    "group inline-flex min-h-12 items-center justify-center gap-3 bg-ink px-6 meta text-paper transition-colors duration-300 hover:bg-charcoal",
  outline:
    "group inline-flex min-h-12 items-center justify-center gap-3 border border-current/40 px-6 meta transition-colors duration-300 hover:border-current",
  text: "group inline-flex min-h-11 items-center gap-2 meta underline-offset-8 decoration-current/40 hover:underline",
} as const;

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`meta flex items-center gap-3 ${className}`} data-reveal="">
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
      {children}
    </p>
  );
}

export function StatusChip({ status }: { status: FormatStatus }) {
  return (
    <span className="meta inline-flex items-center gap-2 border border-current/30 px-2.5 py-1">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${status === "live" ? "bg-brass" : "bg-current opacity-60"}`}
      />
      <span className="sr-only">Status: </span>
      {statusLabels[status]}
    </span>
  );
}

/** Marks content the client has not supplied or approved. Never hidden. */
export function PendingTag({ status }: { status: ContentStatus }) {
  if (status === "published") return null;
  return (
    <span className="meta inline-flex items-center border border-dashed border-current/50 px-2 py-0.5 opacity-80">
      {status === "placeholder" ? "Placeholder" : "Draft — for approval"}
    </span>
  );
}
