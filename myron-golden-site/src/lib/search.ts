/**
 * Site search over the published records. Small enough to run in memory on
 * every request; swap for the CMS's search once the catalogue grows.
 */

export interface SearchDoc {
  id: string;
  kind: 'Page' | 'Program' | 'Book' | 'Event' | 'Video' | 'Article' | 'Resource';
  title: string;
  href: string;
  summary: string;
  keywords?: string[];
}

export interface SearchHit extends SearchDoc {
  score: number;
}

export function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((t) => t.length > 1);
}

/**
 * Every query word must appear somewhere (title, keywords or summary). Title
 * matches outrank keyword matches, which outrank the summary; whole-word and
 * prefix matches outrank substrings, and the full phrase in the title wins.
 */
export function search(docs: readonly SearchDoc[], query: string, limit = 30): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const phrase = normalise(query);

  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const title = normalise(doc.title);
    const keywords = normalise((doc.keywords ?? []).join(' '));
    const summary = normalise(doc.summary);
    const titleWords = title.split(' ');

    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      let termScore = 0;
      if (titleWords.includes(term)) termScore += 6;
      else if (titleWords.some((w) => w.startsWith(term))) termScore += 4;
      else if (title.includes(term)) termScore += 2;
      if (keywords.includes(term)) termScore += 3;
      if (summary.includes(term)) termScore += 1;
      if (termScore === 0) {
        matchedAll = false;
        break;
      }
      score += termScore;
    }
    if (!matchedAll) continue;
    if (terms.length > 1 && title.includes(phrase)) score += 8;
    hits.push({ ...doc, score });
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
