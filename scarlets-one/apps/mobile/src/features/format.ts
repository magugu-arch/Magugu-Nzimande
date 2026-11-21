import { formatVenueTime, type Fixture, type Locale } from '@scarlets/domain';

export const fixtureTitle = (fixture: Fixture) => `${fixture.home.name} v ${fixture.away.name}`;

export function kickoff(fixture: Fixture, locale: Locale) {
  return formatVenueTime(fixture.kickoffUtc, fixture.venue.timeZone, locale);
}
