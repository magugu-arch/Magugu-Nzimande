import { router } from 'expo-router';
import { bagCount, useBag } from '@/store/bag';
import { HeaderButton } from './Screen';

/** The bag is reachable from every top-level screen (brief §5). */
export function BagButton({ onMedia }: { onMedia?: boolean }) {
  const count = useBag((s) => bagCount(s.lines));
  return (
    <HeaderButton
      icon="bag-outline"
      label="Bag"
      badge={count}
      onMedia={onMedia}
      onPress={() => router.push('/bag')}
    />
  );
}

export function SearchButton({ onMedia }: { onMedia?: boolean }) {
  return (
    <HeaderButton
      icon="search"
      label="Search the shop"
      onMedia={onMedia}
      onPress={() => router.navigate({ pathname: '/shop', params: { focus: 'search' } })}
    />
  );
}
