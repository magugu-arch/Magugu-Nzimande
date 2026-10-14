'use client';

import { useDeferredValue, useState } from 'react';
import { contentTypeLabels, topics } from '@/content/taxonomy';
import type { ContentItem, ContentType, Topic } from '@/content/types';
import { cn } from '@/lib/cn';
import { normalise } from '@/lib/search';
import { ContentCard } from '../cards/Cards';
import { SearchIcon } from '../ui/icons';

/**
 * Search and filter the learning library in place (brief §6, Learn). The full
 * list is server-rendered, so it is indexable and works without JavaScript;
 * filtering only narrows it.
 */
export function LibraryBrowser({
  items,
  types = ['video', 'article', 'resource'],
  tone = 'dark',
}: {
  items: ContentItem[];
  types?: ContentType[];
  tone?: 'dark' | 'light';
}) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<Topic | 'all'>('all');
  const [type, setType] = useState<ContentType | 'all'>('all');
  const deferredQuery = useDeferredValue(query);

  const presentTopics = (Object.keys(topics) as Topic[]).filter((t) =>
    items.some((i) => i.topic === t),
  );
  const terms = normalise(deferredQuery).split(' ').filter(Boolean);

  const haystack = (item: ContentItem) =>
    normalise(`${item.title} ${item.excerpt} ${topics[item.topic].label}`);
  const matches = (item: ContentItem) => {
    if (topic !== 'all' && item.topic !== topic) return false;
    if (type !== 'all' && item.type !== type) return false;
    if (terms.length === 0) return true;
    const hay = haystack(item);
    return terms.every((t) => hay.includes(t));
  };
  const filtered = items.filter(matches);

  const chip = (active: boolean) =>
    cn(
      'pressable h-10 shrink-0 rounded-full px-4 text-[0.875rem] font-medium ring-1',
      active
        ? 'bg-ivory text-ink ring-ivory'
        : 'text-ivory/80 ring-ivory/15 hover:text-ivory hover:ring-ivory/35',
    );

  return (
    <div data-library-browser className={tone === 'light' ? 'text-ink' : undefined}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <label htmlFor="library-search" className="sr-only">
            Search the library
          </label>
          <SearchIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ivory/50"
          />
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or topic"
            className="h-12 w-full rounded-full border border-ivory/15 bg-charcoal pr-4 pl-11 text-ivory placeholder:text-ivory/40 hover:border-ivory/30 focus:border-gold focus:outline-none"
          />
        </div>
        {types.length > 1 ? (
          <div role="group" aria-label="Content type" className="flex flex-wrap gap-2">
            {(['all', ...types] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                data-filter-type={t}
                onClick={() => setType(t)}
                className={chip(type === t)}
              >
                {t === 'all' ? 'All types' : `${contentTypeLabels[t]}s`}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Topic"
        className="-mx-[var(--gutter)] mt-5 flex gap-2 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:none]"
      >
        <button
          type="button"
          aria-pressed={topic === 'all'}
          data-filter-topic="all"
          onClick={() => setTopic('all')}
          className={chip(topic === 'all')}
        >
          All topics
        </button>
        {presentTopics.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={topic === t}
            data-filter-topic={t}
            onClick={() => setTopic(t)}
            className={chip(topic === t)}
          >
            {topics[t].label}
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
      </p>

      {filtered.length === 0 ? (
        <div
          data-library-empty
          className="mt-10 rounded-[1.5rem] bg-charcoal/70 p-10 text-center ring-1 ring-ivory/10"
        >
          <p className="font-display text-[1.75rem] font-semibold">Nothing matches that yet</p>
          <p className="mt-2 text-ivory/70">Try a different word, or clear the filters.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setTopic('all');
              setType('all');
            }}
            className="pressable mt-6 h-11 rounded-full border border-ivory/35 px-5 font-semibold hover:bg-ivory/[0.06]"
          >
            Clear search and filters
          </button>
        </div>
      ) : null}

      {/* Every item stays in the list; filters hide rather than remove. */}
      <ul
        className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
        hidden={filtered.length === 0}
      >
        {items.map((item) => (
          <li
            key={item.id}
            hidden={!matches(item)}
            data-topic={item.topic}
            data-type={item.type}
            data-text={haystack(item)}
          >
            <ContentCard item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
