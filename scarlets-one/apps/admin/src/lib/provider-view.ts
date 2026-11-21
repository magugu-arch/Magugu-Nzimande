import 'server-only';
import { createMockAdapters, defaultControls } from '@scarlets/adapters';
import type { Fixture, SourceMeta } from '@scarlets/domain';

/**
 * What the match-data provider reports for each fixture: its status and, when
 * there is one, its score. The console shows this and can never change it.
 * The provider is on its mock until the club supplies a licensed feed.
 */
export async function providerFixtures(
  now: () => Date,
): Promise<{ byId: Map<string, Fixture>; meta: SourceMeta }> {
  const adapters = createMockAdapters({ controls: () => defaultControls, clock: now });
  const { data, meta } = await adapters.fixtures.listFixtures({});
  return { byId: new Map((data ?? []).map((fixture) => [fixture.id, fixture])), meta };
}
