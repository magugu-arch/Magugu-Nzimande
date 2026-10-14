import type { Metadata } from 'next';
import { BookCard } from '@/components/cards/Cards';
import { PageHero } from '@/components/layout/PageHero';
import { Section } from '@/components/ui/Section';
import { getBooks } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Books',
  description:
    'Books by Myron Golden, including B.O.S.S. Moves and From the Trash Man to the Cash Man.',
  path: '/books',
});

export default function BooksPage() {
  const books = getBooks();
  return (
    <>
      <PageHero
        image="MG-36"
        eyebrow="Books"
        title="The books"
        intro={
          <p>
            Read the thinking behind the teaching, at your own pace. Each book links to its official
            purchase page.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Books', path: '/books' },
        ]}
      />
      <Section tone="ivory" labelledBy="books-list">
        <div className="container-site">
          <h2 id="books-list" className="sr-only">
            All books
          </h2>
          <ul className="grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3" data-reveal-group>
            {books.map((b) => (
              <li key={b.id} data-reveal>
                <BookCard book={b} />
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}
