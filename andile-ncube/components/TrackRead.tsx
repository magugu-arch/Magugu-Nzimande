"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/** Reports `journal_read` once the reader reaches the end of the article. */
export function TrackRead({ slug }: { slug: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        track("journal_read", { story: slug });
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [slug]);
  return <div ref={ref} aria-hidden="true" />;
}
