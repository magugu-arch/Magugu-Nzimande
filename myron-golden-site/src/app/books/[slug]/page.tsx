import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookCover, ContentCard } from '@/components/cards/Cards';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { Eyebrow, Pill, Section } from '@/components/ui/Section';
import { getBook, getBooks, getContent, staticParams } from '@/lib/content';
import { IS_PREVIEW } from '@/lib/env';
import { bookJsonLd, pageMetadata } from '@/lib/seo';

/**
 * Detail pages render their content straight into the static HTML, so every
 * reader and crawler gets the whole page without JavaScript (brief §10).
 * Reading the slug outside <Suspense> means a navigation *could* wait on the
 * server, so the segment opts out of instant validation; the cards that link
 * here prefetch the full page, which keeps navigations instant in practice.
 */
export const instant = false;

export function generateStaticParams() {
  return staticParams(getBooks().map((b) => b.slug));
}

export async function generateMetadata({ params }: PageProps<'/books/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const book = getBook(slug);
  if (!book) return { title: 'Book not found' };
  return pageMetadata({
    title: book.title,
    description: book.synopsis,
    path: `/books/${book.slug}`,
    noindex: book.status === 'draft',
  });
}

export default async function BookPage({ params }: PageProps<'/books/[slug]'>) {
  const { slug } = await params;
  const book = getBook(slug);
  if (!book) notFound();

  const details = [
    { label: 'Author', value: book.role === 'author' ? 'Myron Golden' : 'Credit to be confirmed' },
    { label: 'Formats', value: book.formats.join(', ') || null },
    { label: 'Publisher', value: book.publisher },
    { label: 'ISBN', value: book.isbn },
  ].filter((d): d is { label: string; value: string } => !!d.value);

  const related = getContent().slice(0, 3);

  return (
    <>
      <section className="grain relative bg-ink pt-[calc(var(--header-h)+3rem)] pb-20 md:pb-28">
        <div className="container-site">
          <Breadcrumbs
            className="mb-10"
            trail={[
              { name: 'Home', path: '/' },
              { name: 'Books', path: '/books' },
              { name: book.title, path: `/books/${book.slug}` },
            ]}
          />
          <div className="grid items-start gap-12 md:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div className="mx-auto w-full max-w-md">
              <BookCover book={book} priority sizes="(min-width: 768px) 40vw, 90vw" />
            </div>
            <div>
              <Eyebrow className="mb-5">Book</Eyebrow>
              <h1 className="type-display-lg">{book.title}</h1>
              {book.status === 'draft' ? (
                <Pill className="mt-5" tone="demo">
                  Awaiting confirmation
                </Pill>
              ) : null}
              <p className="type-lede mt-6 max-w-xl text-ivory/80">{book.synopsis}</p>
              {book.buy ? (
                <div className="mt-8">
                  <OutboundLink
                    href={book.buy.href}
                    campaign={`book-${book.slug}`}
                    event="book_outbound_click"
                    label={book.slug}
                    variant="primary"
                    size="lg"
                  >
                    {book.buy.label}
                  </OutboundLink>
                  <p className="mt-3 text-[0.85rem] text-ivory/60">
                    Purchases are completed on the book’s official site.
                  </p>
                </div>
              ) : null}

              {details.length > 0 ? (
                <dl className="mt-10 grid gap-x-8 gap-y-5 border-t border-ivory/10 pt-8 sm:grid-cols-2">
                  {details.map((d) => (
                    <div key={d.label}>
                      <dt className="type-eyebrow text-ivory/55">{d.label}</dt>
                      <dd className="mt-1.5">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {book.idealReader.length > 0 || book.topics.length > 0 ? (
                <div className="mt-10 grid gap-8 sm:grid-cols-2">
                  {book.idealReader.length > 0 ? (
                    <div>
                      <h2 className="type-title">Who it’s for</h2>
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ivory/78">
                        {book.idealReader.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {book.topics.length > 0 ? (
                    <div>
                      <h2 className="type-title">Key topics</h2>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {book.topics.map((t) => (
                          <li key={t}>
                            <Pill tone="muted">{t}</Pill>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {IS_PREVIEW && book.needsConfirmation.length > 0 ? (
                <p className="mt-10 rounded-xl bg-[#1d1810] p-4 text-[0.875rem] text-gold-bright ring-1 ring-gold/25">
                  <strong className="font-semibold">Preview — still to confirm:</strong>{' '}
                  {book.needsConfirmation.join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Section tone="charcoal" labelledBy="related-title">
        <div className="container-site">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Eyebrow className="mb-4">Keep learning</Eyebrow>
              <h2 id="related-title" className="type-display-md">
                Free teaching on the same themes
              </h2>
            </div>
            <Link href="/learn" className="font-semibold text-gold-bright hover:text-ivory">
              Browse the library →
            </Link>
          </div>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <ContentCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {book.status !== 'draft' ? <JsonLd data={bookJsonLd(book)} /> : null}
    </>
  );
}
