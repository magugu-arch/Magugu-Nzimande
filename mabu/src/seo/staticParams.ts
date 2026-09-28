import { contentSnapshot } from '@/content/snapshot.generated';

/**
 * The ids the web export turns into their own pages, so every dish, wine,
 * collection and event has an address a search engine can index and a guest
 * can share. Taken from the content snapshot, which is built from the same
 * content the app serves.
 */
export function snapshotIds(call: string): { id: string }[] {
  return Object.keys(contentSnapshot)
    .filter((key) => key.startsWith(`${call}|`))
    .map((key) => JSON.parse(key.slice(call.length + 1)) as { id: string })
    .filter((args) => typeof args.id === 'string');
}
