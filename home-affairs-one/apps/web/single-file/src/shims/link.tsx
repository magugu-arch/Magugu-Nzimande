import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { ROUTER_MODE, navigate } from './navigation';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children?: ReactNode;
  /* Accepted for compatibility with the framework's link; they mean nothing in one file. */
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

/** Stand-in for the framework's link: internal paths become hash routes. */
export default function Link({
  href,
  children,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  ...rest
}: LinkProps) {
  const internal = href.startsWith('/');
  const { onClick, ...anchor } = rest;

  // Inside a host frame the address cannot carry a route, so the click is handled here.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!internal || ROUTER_MODE !== 'memory' || event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <a href={internal ? `#${href}` : href} onClick={handleClick} {...anchor}>
      {children}
    </a>
  );
}
