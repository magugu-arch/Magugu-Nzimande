/**
 * Plain keyword search over the sample catalogue.
 *
 * No model is involved: the query is split into words, small filler words are
 * dropped, and each remaining word is matched against the start of the words
 * in a service's title and summary, or a guidance article's title, tags and
 * body. Anything matched in a title ranks above everything else.
 */
import {
  type GuidanceArticle,
  type SearchResult,
  type ServiceDefinition,
} from '@hao/api-contracts';

export interface SearchableCatalogue {
  version: string;
  effectiveDate: string;
  services: ServiceDefinition[];
  guidance: GuidanceArticle[];
}

/** Words that carry no meaning on their own in a question such as "how do I replace my ID". */
const FILLER_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'at',
  'be',
  'can',
  'do',
  'does',
  'for',
  'from',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'the',
  'this',
  'to',
  'we',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'you',
  'your',
]);

const SNIPPET_LENGTH = 180;
const TITLE_WEIGHT = 10;
const SUMMARY_WEIGHT = 3;
const BODY_WEIGHT = 1;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The meaningful words in a query, in order, without repeats. */
export function searchTerms(query: string): string[] {
  return [...new Set(words(query))].filter((word) => !FILLER_WORDS.has(word));
}

/** Short terms ("id") must match a whole word; longer ones match the start of a word. */
function hits(term: string, haystack: readonly string[]): boolean {
  return term.length < 3 ? haystack.includes(term) : haystack.some((word) => word.startsWith(term));
}

function countHits(terms: readonly string[], haystack: readonly string[]): number {
  return terms.filter((term) => hits(term, haystack)).length;
}

function shorten(text: string): string {
  if (text.length <= SNIPPET_LENGTH) return text;
  const cut = text.slice(0, SNIPPET_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : SNIPPET_LENGTH).replace(/[\s,;:.]+$/, '')}…`;
}

interface Scored {
  result: SearchResult;
  titleHits: number;
  score: number;
  order: number;
}

export function searchCatalogue(catalogue: SearchableCatalogue, query: string): SearchResult[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  const scored: Scored[] = [];

  catalogue.services.forEach((service, index) => {
    const titleHits = countHits(terms, words(service.title));
    const summaryHits = countHits(terms, words(service.summary));
    const score = titleHits * TITLE_WEIGHT + summaryHits * SUMMARY_WEIGHT;
    if (score === 0) return;
    scored.push({
      titleHits,
      score,
      order: index,
      result: {
        kind: 'SERVICE',
        id: service.code,
        title: service.title,
        snippet: service.summary,
        href: `/services/${service.slug}/`,
      },
    });
  });

  catalogue.guidance.forEach((article, index) => {
    const titleHits = countHits(terms, words(article.title));
    const tagHits = countHits(terms, words(article.tags.join(' ')));
    const paragraphs = article.body.map((paragraph) => words(paragraph));
    const bodyHits = countHits(terms, paragraphs.flat());
    const score = titleHits * TITLE_WEIGHT + tagHits * SUMMARY_WEIGHT + bodyHits * BODY_WEIGHT;
    if (score === 0) return;
    // Quote the first paragraph that mentions the query, so the snippet shows why it matched.
    const matching = paragraphs.findIndex((paragraph) => countHits(terms, paragraph) > 0);
    const snippetSource = article.body[matching >= 0 ? matching : 0] ?? '';
    scored.push({
      titleHits,
      score,
      order: catalogue.services.length + index,
      result: {
        kind: 'GUIDANCE',
        id: article.id,
        title: article.title,
        snippet: shorten(snippetSource),
        href: `/help/guidance/?id=${encodeURIComponent(article.id)}`,
        citation: `${article.title} — sample guidance ${catalogue.version}, effective ${catalogue.effectiveDate}`,
      },
    });
  });

  return scored
    .sort((a, b) => b.titleHits - a.titleHits || b.score - a.score || a.order - b.order)
    .map((entry) => entry.result);
}
