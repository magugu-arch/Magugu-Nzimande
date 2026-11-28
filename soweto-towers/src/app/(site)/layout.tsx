import { Suspense } from 'react';
import { BookBar } from '@/components/site/BookBar';
import { ChatWidget } from '@/components/site/ChatWidget';
import { ConsentManager } from '@/components/site/ConsentManager';
import { JsonLd } from '@/components/site/JsonLd';
import { RevealObserver } from '@/components/site/RevealObserver';
import { ServiceWorker } from '@/components/site/ServiceWorker';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader, SiteHeaderView } from '@/components/site/SiteHeader';
import { StatusStrip } from '@/components/site/StatusStrip';
import { graph, organization, website } from '@/lib/jsonld';

export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <StatusStrip />
      {/* The header reads the URL for the active link; the fallback keeps it in the static shell. */}
      <Suspense fallback={<SiteHeaderView pathname={null} />}>
        <SiteHeader />
      </Suspense>
      <main id="main">{children}</main>
      <SiteFooter />
      <Suspense fallback={null}>
        <BookBar />
      </Suspense>
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
      <ConsentManager />
      <RevealObserver />
      <ServiceWorker />
      <JsonLd data={graph(organization(), website())} />
    </>
  );
}
