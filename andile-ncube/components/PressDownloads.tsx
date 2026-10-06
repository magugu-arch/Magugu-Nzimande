"use client";

import { ArrowDown } from "lucide-react";
import Image from "next/image";
import { getMedia } from "@/data/media";
import { track } from "@/lib/analytics";
import type { Download, MediaId } from "@/lib/types";

const extension = (src: string) => src.split(".").pop()?.toUpperCase() ?? "";

/** Downloadable photographs: the supplied original file, at full resolution. */
export function PhotoDownloads({ ids, kind }: { ids: MediaId[]; kind: "headshot" | "press_photo" }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {ids.map((id) => {
        const asset = getMedia(id);
        return (
          <li key={id}>
            <a
              href={asset.src}
              download={`Andile-Ncube-${id}.${asset.src.split(".").pop()}`}
              onClick={() => track("press_download", { file: id, kind })}
              className="group block"
            >
              <div className={`relative overflow-hidden bg-stone ${kind === "headshot" ? "aspect-[4/5]" : "aspect-[4/3]"}`}>
                <Image src={asset.src} alt={asset.alt} fill sizes="(min-width: 768px) 30vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" style={{ objectPosition: asset.focus }} />
              </div>
              <span className="meta mt-3 flex min-h-11 items-center justify-between gap-2">
                <span>
                  {id} · {extension(asset.src)} · {asset.width}×{asset.height}
                </span>
                <ArrowDown aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
                <span className="sr-only">Download</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Document downloads. Files not yet supplied say so instead of linking nowhere. */
export function DocumentDownloads({ files }: { files: Download[] }) {
  return (
    <ul className="divide-y divide-ink/15 border-y border-ink/15">
      {files.map((f) => (
        <li key={f.id} className="flex min-h-16 flex-wrap items-center justify-between gap-4 py-4">
          <span>
            <span className="font-display block text-[1.35rem] leading-none">{f.label}</span>
            <span className="mt-1 block text-[0.95rem] text-smoke">{f.description}</span>
          </span>
          {f.href ? (
            <a
              href={f.href}
              download
              onClick={() => track(f.id === "partnership-deck" ? "deck_download" : "press_download", { file: f.id })}
              className="meta inline-flex min-h-11 items-center gap-2 border-b border-ink/40"
            >
              Download {f.format} <ArrowDown aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </a>
          ) : (
            <span className="meta text-smoke">On request — file not yet supplied</span>
          )}
        </li>
      ))}
    </ul>
  );
}
