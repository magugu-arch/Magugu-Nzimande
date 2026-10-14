import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHero } from '@/components/layout/PageHero';
import { Pill, Section } from '@/components/ui/Section';
import { ArrowRight, SearchIcon } from '@/components/ui/icons';
import { search } from '@/lib/search';
import { buildSearchIndex } from '@/lib/search-index';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Search',
  description: 'Search programs, books, events and free learning from Myron Golden.',
  path: '/search',
  noindex: true,
});

const suggestions = ['offers', 'sales', 'speaking', 'books', 'coaching', 'stewardship'];

async function Results({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
  const { q } = await searchParams;
  const query = (typeof q === 'string' ? q : '').slice(0, 120).trim();
  return (
    <>
      <SearchForm defaultValue={query} />
      {query ? <ResultList query={query} /> : <Suggestions />}
    </>
  );
}

function SearchForm({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" role="search" className="relative max-w-2xl">
      <label htmlFor="q" className="sr-only">
        Search the site
      </label>
      <SearchIcon
        size={20}
        className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-ivory/50"
      />
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search programs, books, events and learning"
        autoComplete="off"
        className="h-14 w-full rounded-full border border-ivory/15 bg-charcoal pr-32 pl-13 text-[1.0625rem] text-ivory placeholder:text-ivory/40 hover:border-ivory/30 focus:border-gold focus:outline-none"
      />
      <button
        type="submit"
        className="pressable absolute top-1.5 right-1.5 h-11 rounded-full bg-gold px-5 font-semibold text-ink hover:bg-gold-bright"
      >
        Search
      </button>
    </form>
  );
}

function Suggestions() {
  return (
    <div className="mt-10">
      <p className="text-ivory/65">Try one of these:</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <Link
              href={`/search?q=${encodeURIComponent(s)}`}
              className="pressable inline-flex h-10 items-center rounded-full px-4 text-[0.9rem] ring-1 ring-ivory/20 hover:ring-gold/60"
            >
              {s}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultList({ query }: { query: string }) {
  const hits = search(buildSearchIndex(), query);
  return (
    <div className="mt-12">
      <p className="text-ivory/70" role="status">
        {hits.length === 0
          ? `No results for “${query}”.`
          : `${hits.length} ${hits.length === 1 ? 'result' : 'results'} for “${query}”`}
      </p>
      {hits.length === 0 ? (
        <div className="mt-8 max-w-xl rounded-[1.5rem] bg-charcoal p-8 ring-1 ring-ivory/10">
          <p className="font-display text-[1.5rem] font-semibold">Nothing found</p>
          <p className="mt-2 text-ivory/70">
            Check the spelling, try a broader word, or{' '}
            <Link href="/contact?topic=general" className="underline">
              ask the team
            </Link>
            .
          </p>
          <Suggestions />
        </div>
      ) : (
        <ul className="mt-6 max-w-3xl divide-y divide-ivory/10 border-y border-ivory/10">
          {hits.map((h) => (
            <li key={h.id}>
              <Link href={h.href} className="group flex items-start justify-between gap-6 py-5">
                <span>
                  <Pill tone="muted">{h.kind}</Pill>
                  <span className="type-title mt-2 block group-hover:text-gold-bright">
                    {h.title}
                  </span>
                  <span className="type-small mt-1 block text-ivory/65">{h.summary}</span>
                </span>
                <ArrowRight
                  size={20}
                  className="mt-8 shrink-0 text-gold transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SearchPage(props: PageProps<'/search'>) {
  return (
    <>
      <PageHero variant="plain" eyebrow="Search" title="Find what you need" />
      <Section className="!pt-4" labelledBy="search-results">
        <div className="container-site">
          <h2 id="search-results" className="sr-only">
            Results
          </h2>
          <Suspense fallback={<SearchForm />}>
            <Results searchParams={props.searchParams} />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
