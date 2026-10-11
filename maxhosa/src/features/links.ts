import { Linking } from 'react-native';
import { toast } from '@/components/Toast';

export const OFFICIAL_SITE = 'https://maxhosa.africa/';

/** Optional outbound link to the live policies: the app never depends on it. */
export async function openOfficialSite() {
  try {
    await Linking.openURL(OFFICIAL_SITE);
  } catch {
    toast({
      message: 'Couldn’t open maxhosa.africa — it needs an internet connection.',
      icon: 'open-outline',
    });
  }
}
