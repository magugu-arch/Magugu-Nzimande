import Link from "next/link";
import { ctas, menuNav, site } from "@/data/site";
import { buttonClass } from "./ui";

export function Footer() {
  return (
    <footer className="theme-dark border-t border-paper/10 bg-ink text-paper">
      <div className="container-site grid gap-12 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-6">
          <p className="meta text-ash">{site.property}</p>
          <p className="font-display mt-4 text-section">Andile Ncube</p>
          <p className="mt-4 max-w-md text-ash">{site.tagline}</p>
          <Link href={ctas.partner.href} className={`${buttonClass.solid} mt-8`}>
            {ctas.partner.label}
          </Link>
        </div>
        <nav aria-label="Footer" className="md:col-span-3 md:col-start-8">
          <ul className="grid gap-1">
            {menuNav.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="meta inline-flex min-h-11 items-center text-ash hover:text-paper">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-2">
          <ul className="grid gap-1">
            <li>
              <Link href="/press" className="meta inline-flex min-h-11 items-center text-ash hover:text-paper">
                Press kit
              </Link>
            </li>
            <li>
              <Link href={ctas.deck.href} className="meta inline-flex min-h-11 items-center text-ash hover:text-paper">
                Partnership deck
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container-site flex flex-col gap-3 border-t border-paper/10 py-6 text-ash md:flex-row md:items-center md:justify-between">
        <p className="meta">© {site.name}. The show, the audience and the IP belong to Andile.</p>
        <p className="meta">Production &amp; commercial engine: {site.engine}</p>
      </div>
    </footer>
  );
}
