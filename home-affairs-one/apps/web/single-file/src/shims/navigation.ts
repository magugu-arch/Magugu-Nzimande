/**
 * Stand-in for the framework's navigation hooks, for the single-file build.
 *
 * From a file, routes live in the URL hash (`file.html#/services/`), so the
 * whole app works with no server; a hash that is not a route (`#main`,
 * `#identity`) is treated as an ordinary in-page anchor.
 *
 * Inside a host frame that only passes plain `#name` hashes (a published
 * Artifact), routes are kept in memory instead and the hash is left alone.
 */
import { useMemo, useSyncExternalStore } from 'react';

/** `hash` for a file opened from disk or a web host; `memory` inside a host frame. */
export const ROUTER_MODE: 'hash' | 'memory' =
  process.env.HAO_ROUTER === 'memory' ? 'memory' : 'hash';

const listeners = new Set<() => void>();
const visited: string[] = [];

function readRoute(): string {
  if (ROUTER_MODE === 'memory') return '/';
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  return hash.startsWith('#/') ? hash.slice(1) : '/';
}

let route = readRoute();

function setRoute(next: string) {
  if (next === route) return;
  route = next;
  for (const listener of listeners) listener();
}

function goToAnchor(id: string) {
  const target = document.getElementById(id);
  // Put the route back in the address so a refresh or share still lands on this screen.
  window.history.replaceState(null, '', `#${route}`);
  if (!target) return;
  target.scrollIntoView({ block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

if (typeof window !== 'undefined' && ROUTER_MODE === 'hash') {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash.length > 1 && !hash.startsWith('#/')) {
      goToAnchor(decodeURIComponent(hash.slice(1)));
      return;
    }
    setRoute(readRoute());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const getRoute = () => route;
const getServerRoute = () => '/';

function useRoute(): string {
  return useSyncExternalStore(subscribe, getRoute, getServerRoute);
}

/** `/services/` — always with a trailing slash, like the static site. */
export function usePathname(): string {
  const [pathname = '/'] = useRoute().split('?');
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function useSearchParams(): URLSearchParams {
  const query = useRoute().split('?')[1] ?? '';
  return useMemo(() => new URLSearchParams(query), [query]);
}

function toHref(href: string): string {
  return href.startsWith('/') ? href : `/${href}`;
}

/** Go to a route. In memory mode this is the only way routes change. */
export function navigate(href: string, options: { replace?: boolean } = {}) {
  const next = toHref(href);
  if (ROUTER_MODE === 'memory') {
    if (!options.replace && next !== route) visited.push(route);
    setRoute(next);
    return;
  }
  if (options.replace) {
    window.history.replaceState(null, '', `#${next}`);
    setRoute(next);
  } else {
    window.location.hash = next;
  }
}

export function useRouter() {
  return useMemo(
    () => ({
      push(href: string) {
        navigate(href);
      },
      replace(href: string) {
        navigate(href, { replace: true });
      },
      back() {
        if (ROUTER_MODE === 'memory') setRoute(visited.pop() ?? '/');
        else window.history.back();
      },
      forward() {
        window.history.forward();
      },
      refresh() {
        // Nothing to refetch from a server: queries refresh themselves.
      },
      prefetch() {
        // Everything is already in the file.
      },
    }),
    [],
  );
}

export class NotFoundError extends Error {
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

export function notFound(): never {
  throw new NotFoundError();
}
