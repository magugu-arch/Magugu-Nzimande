import { fireEvent, render, screen } from '@testing-library/react-native';
import { FavouriteButton } from '@/components/ui';
import { useFavouritesStore } from '@/store/favouritesStore';

// The store lives outside React, so driving it directly needs no `act` — and
// calling `act` with nothing mounted upsets the test renderer.
const reset = () => useFavouritesStore.getState().clear();

describe('favourites store', () => {
  beforeEach(reset);

  it('starts empty', () => {
    expect(useFavouritesStore.getState().productIds).toEqual([]);
  });

  it('toggles a product on and back off', () => {
    const { toggle } = useFavouritesStore.getState();

    toggle('golden-original');
    expect(useFavouritesStore.getState().isFavourite('golden-original')).toBe(true);

    toggle('golden-original');
    expect(useFavouritesStore.getState().isFavourite('golden-original')).toBe(false);
  });

  it('keeps the most recently hearted first', () => {
    const { toggle } = useFavouritesStore.getState();

    toggle('one');
    toggle('two');
    toggle('three');

    // Newest first, so the list reads as a history rather than menu order.
    expect(useFavouritesStore.getState().productIds).toEqual(['three', 'two', 'one']);
  });

  it('removes without disturbing the rest', () => {
    const { toggle, remove } = useFavouritesStore.getState();

    toggle('one');
    toggle('two');
    remove('one');

    expect(useFavouritesStore.getState().productIds).toEqual(['two']);
  });

  it('never stores a duplicate, however many times it is tapped', () => {
    const { toggle } = useFavouritesStore.getState();

    toggle('one');
    toggle('one');
    toggle('one');

    expect(useFavouritesStore.getState().productIds).toEqual(['one']);
  });
});

describe('FavouriteButton', () => {
  beforeEach(reset);

  it('names the product it acts on, and says which way it will go', () => {
    // A screen reader meeting "Favourite" sixteen times down a menu learns
    // nothing, so the label carries both the product and the direction.
    render(<FavouriteButton productId="golden-original" productName="Golden Original Chicken" />);
    expect(screen.getByLabelText('Add Golden Original Chicken to favourites')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Add Golden Original Chicken to favourites'));
    expect(screen.getByLabelText('Remove Golden Original Chicken from favourites')).toBeTruthy();
  });

  it('reports its state to assistive tech, not only in colour', () => {
    // §32.4: colour must never be the only carrier. The icon changes shape
    // too, and the accessibility state makes it available non-visually.
    render(<FavouriteButton productId="honey-garlic" productName="Honey Garlic Chicken" />);

    const before = screen.getByTestId('favourite-honey-garlic');
    expect(before.props.accessibilityState.selected).toBe(false);

    fireEvent.press(before);
    expect(screen.getByTestId('favourite-honey-garlic').props.accessibilityState.selected).toBe(
      true,
    );
  });

  it('writes through to the store', () => {
    render(<FavouriteButton productId="soy-garlic" productName="Soy Garlic Chicken" />);

    fireEvent.press(screen.getByTestId('favourite-soy-garlic'));
    expect(useFavouritesStore.getState().productIds).toEqual(['soy-garlic']);
  });
});
