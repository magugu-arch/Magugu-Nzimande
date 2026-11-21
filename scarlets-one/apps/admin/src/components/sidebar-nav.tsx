'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  id: string;
  href: string;
  label: string;
  count?: number;
}

/** Section links. The list is built on the server from the signed-in role. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Console sections">
      <ul className="nav">
        {items.map((item) => {
          const current = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="nav__link"
                aria-current={current ? 'page' : undefined}
              >
                <span>{item.label}</span>
                {item.count ? (
                  <span className="nav__count">
                    {item.count}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
