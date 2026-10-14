import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentDetail } from '@/components/learn/ContentDetail';
import { getContent, getContentItem, staticParams } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

/** Videos and resources. Articles live at /insights/[slug]. */
const findItem = (slug: string) => {
  const item = getContentItem(slug);
  return item && item.type !== 'article' ? item : undefined;
};

export function generateStaticParams() {
  return staticParams(
    getContent()
      .filter((c) => c.type !== 'article')
      .map((c) => c.slug),
  );
}

export async function generateMetadata({ params }: PageProps<'/learn/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const item = findItem(slug);
  if (!item) return { title: 'Not found' };
  return pageMetadata({
    title: item.title,
    description: item.excerpt,
    path: `/learn/${item.slug}`,
    noindex: !!item.isDemo,
  });
}

export default async function LearnItemPage({ params }: PageProps<'/learn/[slug]'>) {
  const { slug } = await params;
  const item = findItem(slug);
  if (!item) notFound();
  return (
    <ContentDetail
      item={item}
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Learn', path: '/learn' },
        { name: item.title, path: `/learn/${item.slug}` },
      ]}
    />
  );
}
