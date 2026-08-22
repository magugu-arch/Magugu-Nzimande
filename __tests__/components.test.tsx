import { fireEvent, render, screen } from '@testing-library/react-native';
import { FoodImage } from '@/components/food/FoodImage';
import { Button, QuantityStepper, Text } from '@/components/ui';
import { businessRules } from '@/constants/config';
import {
  FOOD_ASSET_LABELS,
  PENDING_ASSET_KEYS,
  hasFoodAsset,
  isSubstituted,
} from '@/constants/foodAssets';

describe('Text', () => {
  it('renders its children', () => {
    render(<Text>Golden Original</Text>);
    expect(screen.getByText('Golden Original')).toBeTruthy();
  });
});

describe('Button', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<Button label="Add to cart" onPress={onPress} testID="cta" />);

    fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Add to cart" onPress={onPress} disabled testID="cta" />);

    fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire while loading', () => {
    const onPress = jest.fn();
    render(<Button label="Add to cart" onPress={onPress} loading testID="cta" />);

    fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reads the trailing label out as part of its accessible name', () => {
    render(
      <Button label="Place order" onPress={jest.fn()} trailingLabel="R 237.00" testID="cta" />,
    );
    expect(screen.getByLabelText('Place order, R 237.00')).toBeTruthy();
  });
});

describe('QuantityStepper', () => {
  it('increments and decrements', () => {
    const onChange = jest.fn();
    render(<QuantityStepper quantity={2} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onChange).toHaveBeenLastCalledWith(3);

    fireEvent.press(screen.getByLabelText('Decrease quantity'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('turns the decrement into a remove at the minimum', () => {
    const onRemove = jest.fn();
    const onChange = jest.fn();
    render(<QuantityStepper quantity={1} onChange={onChange} onRemove={onRemove} />);

    fireEvent.press(screen.getByLabelText('Remove item'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('will not increment past the maximum', () => {
    const onChange = jest.fn();
    render(
      <QuantityStepper quantity={businessRules.maxQuantityPerLine} onChange={onChange} />,
    );

    fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('FoodImage', () => {
  it('labels a supplied asset with its product name', () => {
    render(<FoodImage assetKey="goldenOriginal" variant="card" />);
    expect(hasFoodAsset('goldenOriginal')).toBe(true);
    expect(screen.getByLabelText('Golden Original Chicken')).toBeTruthy();
  });

  it('labels a substituted product with its own name, not the stand-in\'s', () => {
    const pending = PENDING_ASSET_KEYS.find(isSubstituted);
    if (!pending) return; // Every product has its own artwork now.

    render(<FoodImage assetKey={pending} variant="card" />);
    // The photo is borrowed, but the alt text must describe what was ordered.
    expect(screen.getByLabelText(FOOD_ASSET_LABELS[pending])).toBeTruthy();
  });
});
