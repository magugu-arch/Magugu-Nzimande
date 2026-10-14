import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/PageHero';
import { LibraryBrowser } from '@/components/learn/LibraryBrowser';
import { Section } from '@/components/ui/Section';
import { getArticles } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Insights',
  description:
    'Articles from Myron Golden on offers, sales, business growth, stewardship and purpose.',
  path: '/insights',
});

export default function InsightsPage() {
  return (
    <>
      <PageHero
        image="MG-17"
        eyebrow="Insights"
        title="Ideas worth sitting with"
        intro={<p>Articles and notes on building, selling and stewarding a business well.</p>}
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Insights', path: '/insights' },
        ]}
      />
      <Section labelledBy="articles-title" className="!pt-14">
        <div className="container-site">
          <h2 id="articles-title" className="sr-only">
            Articles
          </h2>
          <LibraryBrowser items={getArticles()} types={['article']} />
        </div>
      </Section>
    </>
  );
}
