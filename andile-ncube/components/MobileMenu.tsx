"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ctas, menuNav, site } from "@/data/site";

/**
 * Full-screen menu on a native <dialog>: the browser handles focus trapping,
 * Escape to close, and making the page behind it inert.
 */
export function MobileMenu({ pathname }: { pathname: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Close whenever the route changes underneath it.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  const open = () => {
    dialog.current?.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="meta inline-flex min-h-11 items-center px-3 lg:hidden"
      >
        Menu
      </button>
      <dialog
        ref={dialog}
        aria-label="Site menu"
        onClose={() => {
          document.documentElement.style.overflow = "";
        }}
        className="theme-dark m-0 h-dvh max-h-none w-screen max-w-none bg-ink p-0 text-paper backdrop:bg-ink"
      >
        <div className="container-site flex min-h-full flex-col">
          <div className="flex h-[var(--header-h)] items-center justify-between">
            <span className="meta font-semibold tracking-[0.24em]">Andile</span>
            <button
              type="button"
              onClick={close}
              className="meta inline-flex min-h-11 items-center gap-2 px-3"
              autoFocus
            >
              Close <X aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </button>
          </div>
          <nav aria-label="Menu" className="flex flex-1 flex-col justify-center py-8">
            <ul className="space-y-1">
              {menuNav.map((item, i) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className="font-display flex min-h-12 items-baseline gap-4 text-[clamp(2.25rem,9vw,4rem)] leading-[1.05] hover:text-stone"
                  >
                    <span className="meta w-6 text-ash" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-4 border-t border-paper/15 py-6">
            <Link href={ctas.partner.href} onClick={close} className="meta inline-flex min-h-12 items-center justify-center bg-paper text-ink">
              {ctas.partner.label}
            </Link>
            <p className="meta text-ash">{site.disciplines.join(" • ")}</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
