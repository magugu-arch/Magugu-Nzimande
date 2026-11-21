'use client';

import {
  createContext,
  createElement,
  useContext,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from 'react';

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
export type LinkComponent = ComponentType<LinkProps>;

const DefaultLink: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

const LinkContext = createContext<LinkComponent>(DefaultLink);

/**
 * Lets the host app supply its router's link (for example `next/link`) so every
 * link-like component in the design system navigates client-side.
 */
export function DesignSystemProvider({
  linkComponent,
  children,
}: {
  linkComponent: LinkComponent;
  children: ReactNode;
}) {
  return <LinkContext.Provider value={linkComponent}>{children}</LinkContext.Provider>;
}

/** An anchor rendered through the host app's router link. */
export function AppLink(props: LinkProps) {
  // The link component is supplied once by the host app through context; it is
  // not created here, so rendering it by reference is safe.
  return createElement(useContext(LinkContext), props);
}
