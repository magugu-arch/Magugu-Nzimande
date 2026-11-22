import { Container, LinkButton, LoadingState, PageHeader } from '@hao/design-system';
import { Component, Suspense, use, useEffect, type ReactNode } from 'react';
import { ROUTES, type RouteDef } from './generated/routes';
import { NotFoundError, usePathname } from './shims/navigation';

const SITE = 'Home Affairs One (concept)';

function findRoute(pathname: string): { route: RouteDef; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter(Boolean);
  for (const route of ROUTES) {
    if (route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = route.segments.every((segment, index) => {
      const part = parts[index] ?? '';
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(part);
        return true;
      }
      return segment === part;
    });
    if (matches) return { route, params };
  }
  return null;
}

/* A page with a path parameter is written as an async function (it awaits its
   params). Call it once per address and let React wait for the result. */
const rendered = new Map<string, Promise<ReactNode>>();

function ParamPage({ route, params }: { route: RouteDef; params: Record<string, string> }) {
  const key = `${route.pattern}?${JSON.stringify(params)}`;
  let element = rendered.get(key);
  if (!element) {
    const page = route.Page as (props: { params: Promise<Record<string, string>> }) => unknown;
    element = Promise.resolve().then(() =>
      page({ params: Promise.resolve(params) }),
    ) as Promise<ReactNode>;
    rendered.set(key, element);
  }
  return <>{use(element)}</>;
}

function NotFound() {
  return (
    <Container width="narrow">
      <PageHeader
        title="We could not find that page"
        lede="It may have moved, or the address may be wrong."
      />
      <LinkButton href="/">Go to the start page</LinkButton>
    </Container>
  );
}

class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(error: unknown) {
    if (error instanceof NotFoundError) return { failed: true };
    throw error;
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function withLayouts(route: RouteDef | null, page: ReactNode): ReactNode {
  const layouts = route?.layouts ?? ROUTES[0]?.layouts ?? [];
  return layouts.reduceRight<ReactNode>((child, Layout) => <Layout>{child}</Layout>, page);
}

export function Router() {
  const pathname = usePathname();
  const found = findRoute(pathname);

  useEffect(() => {
    document.title = found?.route.title ? `${found.route.title} · ${SITE}` : `${SITE} prototype`;
    window.scrollTo(0, 0);
  }, [pathname, found?.route.title]);

  if (!found) return <>{withLayouts(null, <NotFound />)}</>;
  const { route, params } = found;
  const Page = route.Page as () => ReactNode;

  return (
    <>
      {withLayouts(
        route,
        <Boundary key={pathname} fallback={<NotFound />}>
          <Suspense fallback={<LoadingState label="Loading" rows={2} />}>
            {route.dynamic ? <ParamPage route={route} params={params} /> : <Page />}
          </Suspense>
        </Boundary>,
      )}
    </>
  );
}
