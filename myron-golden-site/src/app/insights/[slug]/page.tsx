import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentDetail } from '@/components/learn/ContentDetail';
import { getArticles, getContentItem, staticParams } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

const findArticle = (slug: string) => {
  const item = getContentItem(slug);
  return item && item.type === 'article' ? item : undefined;
};

/**
 * Detail pages render their content straight into the static HTML, so every
 * reader and crawler gets the whole page without JavaScript (brief §10).
 * Reading the slug outside <Suspense> means a navigation *could* wait on the
 * server, so the segment opts out of instant validation; the cards that link
 * here prefetch the full page, which keeps navigations instant in practice.
 */
export const instant = false;

export function generateStaticParams() {
  return staticParams(getArticles().map((a) => a.slug));
}

export async function generateMetadata({
  params,
}: PageProps<'/insights/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const item = findArticle(slug);
  if (!item) return { title: 'Not found' };
  return pageMetadata({
    title: item.title,
    description: item.excerpt,
    path: `/insights/${item.slug}`,
    noindex: !!item.isDemo,
  });
}

export default async function InsightPage({ params }: PageProps<'/insights/[slug]'>) {
  const { slug } = await params;
  const item = findArticle(slug);
  if (!item) notFound();
  return (
    <ContentDetail
      item={item}
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Insights', path: '/insights' },
        { name: item.title, path: `/insights/${item.slug}` },
      ]}
    />
  );
}
