import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { nav } from '../../data/site';
import { ButtonLink } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { MobileNav } from './MobileNav';

/**
 * Floats over the hero, then settles onto black with a hairline once the
 * page scrolls, so the nav never sits on top of body text unreadably.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <a href="#main" className="ui-label sr-only z-[70] bg-white px-4 py-3 text-black focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <header
        className={`page-gutter fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500 ${
          scrolled || open ? 'border-b border-line bg-black' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-6 lg:h-20">
          <Link to="/" aria-label="Grateful — home" className="-m-2 flex min-h-11 items-center p-2">
            <Logo className="h-7 lg:h-8" />
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-10">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `ui-label relative inline-flex min-h-11 items-center transition-opacity hover:opacity-100 ${isActive ? 'opacity-100 after:absolute after:inset-x-0 after:bottom-2 after:h-px after:bg-white' : 'opacity-70'}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <ButtonLink to="/booking" variant="secondary" className="min-h-10 px-5">
                Book a Consultation
              </ButtonLink>
            </div>
            <button
              type="button"
              className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-3 lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(true)}
            >
              <span className="ui-label">Menu</span>
              <Menu aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <MobileNav open={open} onClose={() => setOpen(false)} />
    </>
  );
}
