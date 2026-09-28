import { Linking, Platform, Share } from 'react-native';
import { track } from './analytics';

export type MapsApp = 'google' | 'apple' | 'waze';

export function directionsUrl(query: string, app: MapsApp): string {
  const q = encodeURIComponent(query);
  switch (app) {
    case 'apple':
      return `https://maps.apple.com/?daddr=${q}`;
    case 'waze':
      return `https://waze.com/ul?q=${q}&navigate=yes`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }
}

export async function openDirections(
  query: string,
  app: MapsApp = Platform.OS === 'ios' ? 'apple' : 'google',
) {
  track('directions_opened', { app });
  await Linking.openURL(directionsUrl(query, app));
}

export async function callVenue(phone: string) {
  track('call_started');
  await Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
}

export function mailtoUrl(email: string, subject?: string, body?: string): string {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : '',
    body ? `body=${encodeURIComponent(body)}` : '',
  ].filter(Boolean);
  return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
}

export async function emailVenue(email: string, subject?: string, body?: string) {
  track('email_started');
  await Linking.openURL(mailtoUrl(email, subject, body));
}

export async function shareText(title: string, message: string, url?: string) {
  try {
    await Share.share(
      Platform.OS === 'ios' && url
        ? { title, message, url }
        : { title, message: url ? `${message}\n${url}` : message },
    );
  } catch {
    // Dismissed or unsupported — nothing to do.
  }
}
