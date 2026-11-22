import type { AnchorHTMLAttributes, ReactNode } from 'react';

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
  return (
    <a href={internal ? `#${href}` : href} {...rest}>
      {children}
    </a>
  );
}
