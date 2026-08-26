import { useCallback, useState } from 'react';
import type { AppPreferences, NotificationPreferences } from '@/types';
import { updateRemotePreferences } from '@/services/accountService';
import { useAuthStore } from '@/store/authStore';

/**
 * Toggling something the server has to know about.
 *
 * Every switch on the preferences screen wrote to AsyncStorage and stopped
 * there. A customer switching off "Promotions" changed a local boolean and the
 * promotions kept arriving, because nobody had been told. `marketingConsent`
 * is the one with teeth: it is captured at registration and sent, and from
 * then on the app offered a switch that reached nobody. Under POPIA a
 * withdrawal of consent to direct marketing has to be actionable.
 *
 * Applied locally first so the switch moves under the thumb, then sent — and
 * put back if the send fails. Leaving it switched off after a failed request
 * would tell somebody they had opted out when they had not, which is the one
 * outcome worse than the switch not moving at all.
 *
 * `defaultFulfilment` does not come through here: what the app pre-selects
 * when it opens is a fact about the handset, and no server needs it.
 */
export interface RemotePreferenceControls {
  setNotification: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => void;
  setMarketingConsent: (value: boolean) => void;
  /** Set while a change is in flight, so the screen can say so. */
  saving: boolean;
  /** What went wrong, for the screen to show, or null. */
  error: string | null;
  dismissError: () => void;
}

export function useRemotePreferences(): RemotePreferenceControls {
  const notifications = useAuthStore((state) => state.notificationPreferences);
  const preferences = useAuthStore((state) => state.preferences);
  const setNotificationPreference = useAuthStore((state) => state.setNotificationPreference);
  const setPreference = useAuthStore((state) => state.setPreference);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The state to send is worked out here rather than read back from the store,
   * because the store has only just been told and a stale read would send the
   * previous answer — the exact shape of bug this screen is fixing.
   */
  const push = useCallback(
    async (
      next: { notifications: NotificationPreferences; marketingConsent: boolean },
      undo: () => void,
    ) => {
      setSaving(true);
      setError(null);
      try {
        await updateRemotePreferences(next);
      } catch (caught) {
        undo();
        setError(
          caught instanceof Error
            ? `${caught.message} Your preference was not changed.`
            : 'We could not save that. Your preference was not changed.',
        );
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const setNotification = useCallback(
    <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
      const previous = notifications[key];
      setNotificationPreference(key, value);
      void push(
        {
          notifications: { ...notifications, [key]: value },
          marketingConsent: preferences.marketingConsent,
        },
        () => setNotificationPreference(key, previous),
      );
    },
    [notifications, preferences.marketingConsent, setNotificationPreference, push],
  );

  const setMarketingConsent = useCallback(
    (value: boolean) => {
      const previous = preferences.marketingConsent;
      setPreference('marketingConsent', value as AppPreferences['marketingConsent']);
      void push({ notifications, marketingConsent: value }, () =>
        setPreference('marketingConsent', previous),
      );
    },
    [notifications, preferences.marketingConsent, setPreference, push],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { setNotification, setMarketingConsent, saving, error, dismissError };
}
