"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ctas, desktopNav } from "@/data/site";
import { track } from "@/lib/analytics";
import { MobileMenu } from "./MobileMenu";

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Transparent over the hero, solid once the page scrolls. Full navigation from
 * 1024px; below that, the ANDILE / MENU / PARTNER bar and a full-screen menu.
 */
export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // Pages that open on light paper rather than a dark hero keep the bar solid.
  const solid = scrolled || pathname.startsWith("/journal") || pathname.startsWith("/press");

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);

  return (
    <header
      className={`theme-dark fixed inset-x-0 top-0 z-50 text-paper transition-[background-color,border-color] duration-500 ${
        solid ? "border-b border-paper/10 bg-ink/95 backdrop-blur-sm" : "border-b border-transparent bg-transparent"
      }`}
    >
      <a
        href="#main"
        className="meta sr-only z-50 bg-paper px-4 py-3 text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <div className="container-site flex h-[var(--header-h)] items-center justify-between gap-6">
        <Link href="/" className="meta flex min-h-11 items-center font-semibold tracking-[0.24em]" aria-label="Andile Ncube — home">
          <span className="lg:hidden">Andile</span>
          <span className="hidden lg:inline">Andile Ncube</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-7 xl:gap-9">
            {desktopNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`meta relative flex min-h-11 items-center transition-opacity hover:opacity-100 ${
                      active ? "opacity-100" : "opacity-70"
                    }`}
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 bottom-2 h-px origin-left bg-current transition-transform duration-500 ease-[var(--ease-cinematic)] ${
                        active ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={ctas.partner.href}
            onClick={() => track("partnership_start", { source: "header" })}
            className="meta hidden min-h-11 items-center border border-paper/40 px-5 transition-colors hover:border-paper hover:bg-paper hover:text-ink lg:inline-flex"
          >
            {ctas.partner.label}
          </Link>
          <MobileMenu pathname={pathname} />
          <Link
            href={ctas.partner.href}
            onClick={() => track("partnership_start", { source: "header_mobile" })}
            className="meta inline-flex min-h-11 items-center bg-paper px-4 text-ink lg:hidden"
          >
            Partner
          </Link>
        </div>
      </div>
    </header>
  );
}
