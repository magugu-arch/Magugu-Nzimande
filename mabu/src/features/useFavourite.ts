import { router } from 'expo-router';
import type { FavouriteKind } from '@/domain/guests/types';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';

/** Saved state for one item, and a toggle that asks a signed-out guest to sign in. */
export function useFavourite(kind: FavouriteKind, itemId: string) {
  const signedIn = useSession((s) => !!s.actor);
  const list = useRpc('favourites.list', undefined, { enabled: signedIn });
  const toggle = useRpcMutation('favourites.toggle', ['favourites.list']);
  const saved = !!list.data?.some((f) => f.kind === kind && f.itemId === itemId);
  return {
    saved,
    toggle: () => {
      if (!signedIn) {
        router.push('/sign-in');
        return;
      }
      toggle.mutate({ kind, itemId });
    },
  };
}
