import AsyncStorage from '@react-native-async-storage/async-storage';
import { OFFLINE_POLICY, offlinePolicyFor } from '@/core/offline/policy';
import { offlineCache } from '@/data/offlineCache';
import { photoLibrary, standInSlots } from '@/content/photos';
import { photoFiles } from '@/content/photoFiles.generated';
import { SERVICES } from '@/content/services';
import { NATIONAL_EMERGENCY } from '@/content/emergency';
import { CAPABILITIES } from '@/core/permissions/policy';
import { safetyContacts, knowledge } from '@/core/fixtures/support';
import { southCampus, directory } from '@/core/fixtures/campus';
import { search } from '@/features/search/searchIndex';
import { visits } from '@/features/notifications/delivery';

describe('offline policy (brief §25)', () => {
  it('never caches money, results or wellbeing', () => {
    for (const key of [
      'account',
      'transactions',
      'funding',
      'results',
      'guardian-fees',
      'wellbeing',
    ]) {
      expect(offlinePolicyFor([key, 'u'])).toBe('never');
    }
  });

  it('caches today’s timetable, notifications, campus info, tickets and safety contacts', () => {
    for (const key of ['timetable', 'notifications', 'campus-map', 'tickets', 'safety-contacts']) {
      expect(offlinePolicyFor([key])).toBe('cache');
    }
  });

  it('treats anything unlisted as never', () => {
    expect(offlinePolicyFor(['something-new'])).toBe('never');
    expect(Object.values(OFFLINE_POLICY).every((p) => p === 'cache' || p === 'never')).toBe(true);
  });

  it('refuses to write a sensitive key even if asked', async () => {
    await AsyncStorage.clear();
    await offlineCache.write(['account', 'u1'], { balance: 1 });
    expect(await offlineCache.read(['account', 'u1'])).toBeNull();
    await offlineCache.write(['timetable', 'u1', 'today'], [1, 2]);
    expect((await offlineCache.read<number[]>(['timetable', 'u1', 'today']))?.data).toEqual([1, 2]);
    await offlineCache.clearFor('u1');
    expect(await offlineCache.read(['timetable', 'u1', 'today'])).toBeNull();
  });
});

describe('photo library (brief §18)', () => {
  it('fills all 18 slots from supplied photographs, in three sizes', () => {
    expect(Object.keys(photoLibrary)).toHaveLength(18);
    for (const slot of Object.values(photoLibrary)) {
      expect(photoFiles[slot.file]).toBeDefined();
      expect(slot.alt.length).toBeGreaterThan(20);
    }
  });

  it('flags the one slot still waiting on its own photograph', () => {
    expect(standInSlots).toEqual(['alumniMentorship']);
  });
});

describe('safety content (brief §13)', () => {
  it('bundles only verified national numbers and never invents campus ones', () => {
    for (const c of NATIONAL_EMERGENCY) {
      expect(c.verified).toBe(true);
      expect(c.phone).toMatch(/^\d+$/);
    }
    for (const c of safetyContacts.filter((x) => x.scope === 'campus')) {
      expect(c.phone).toBeNull();
      expect(c.verified).toBe(false);
    }
  });

  it('labels every help article with an owner awaiting approval', () => {
    for (const a of knowledge('2026-10-01T00:00:00Z')) expect(a.source).toContain('owner approval');
  });
});

describe('service directory and search', () => {
  it('guards every service with a known capability', () => {
    for (const s of SERVICES) expect(CAPABILITIES).toContain(s.capability);
  });

  const sources = {
    services: SERVICES,
    buildings: southCampus.buildings,
    people: directory,
    events: [],
    articles: knowledge('2026-10-01T00:00:00Z'),
    wellbeing: [],
  };

  it('turns a room code into directions', () => {
    const r = search('EB212', sources);
    expect(r.place[0]).toMatchObject({
      title: 'EB212 · Business & Economics Building',
      href: '/campus-map?to=EB212',
    });
  });

  it('finds people, services and help by any word', () => {
    expect(search('ndlovu', sources).person[0]?.title).toBe('Dr Sipho Ndlovu');
    expect(search('nsfas', sources).service.map((s) => s.id)).toContain('funding');
    expect(search('residence request', sources).support[0]?.href).toBe('/residence/request');
    expect(Object.values(search('zzzz', sources)).flat()).toHaveLength(0);
  });
});

describe('notifications settle when their destination is visited', () => {
  it('matches the path and any query the action carries', () => {
    expect(visits('/money/funding', '/money/funding', {})).toBe(true);
    expect(visits('/campus-map?to=EB212', '/campus-map', { to: 'EB212' })).toBe(true);
    expect(visits('/campus-map?to=EB212', '/campus-map', { to: 'LIB' })).toBe(false);
    expect(visits('/money/funding', '/money', {})).toBe(false);
  });
});
