import { site } from '@/content/site';
import { hmInSast, type Hm, type Ymd } from './time';

/**
 * Sunrise and sunset from the standard sunrise equation (accurate to about a
 * minute), for the towers' coordinates. The site closes at sunset, so this
 * drives opening hours, the last bookable slot and the tower status strip.
 */

const RAD = Math.PI / 180;
const J2000 = 2451545.0;

function julianFromDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

function dateFromJulian(j: number): Date {
  return new Date((j - 2440587.5) * 86_400_000);
}

export function sunTimes(ymd: Ymd, lat: number = site.geo.lat, lng: number = site.geo.lng): { sunrise: Date; sunset: Date } {
  const noonUtc = new Date(`${ymd}T12:00:00Z`);
  const n = Math.round(julianFromDate(noonUtc) - J2000 + 0.0008);
  const meanSolarNoon = n - lng / 360;
  const M = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = J2000 + meanSolarNoon + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
  const H = Math.acos(Math.min(1, Math.max(-1, cosH))) / RAD;
  return {
    sunrise: dateFromJulian(transit - H / 360),
    sunset: dateFromJulian(transit + H / 360),
  };
}

/** Sunset as SAST 'HH:MM' for a calendar day. */
export function sunsetHm(ymd: Ymd): Hm {
  return hmInSast(sunTimes(ymd).sunset);
}
