import { Dimensions, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FoodImage } from '@/components/food/FoodImage';
import { NutritionPanel } from '@/features/menu/components/NutritionPanel';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { Button, QuantityStepper, Text } from '@/components/ui';
import { businessRules } from '@/constants/config';
import { CHROME_FONT_SCALE_CAP, MIN_TOUCH_TARGET } from '@/theme';
import {
  FOOD_ASSET_LABELS,
  PENDING_ASSET_KEYS,
  hasFoodAsset,
  isSubstituted,
} from '@/constants/foodAssets';

/**
 * Pin the OS text size for a test.
 *
 * jest-expo's Dimensions mock reports `fontScale: 2` by default — an enlarged
 * text size, not a normal one — so anything asserting scale-dependent
 * behaviour has to say which regime it means rather than inherit the harness's.
 */
function withFontScale(fontScale: number) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 320, height: 568, scale: 2, fontScale });
}

/** Buttons style with a function of press state, so flatten what it returns. */
function buttonStyle(testID: string) {
  const button = screen.getByTestId(testID);
  return StyleSheet.flatten(
    typeof button.props.style === 'function'
      ? button.props.style({ pressed: false })
      : button.props.style,
  );
}

describe('Text', () => {
  it('renders its children', () => {
    render(<Text>Golden Original</Text>);
    expect(screen.getByText('Golden Original')).toBeTruthy();
  });
});

describe('Button', () => {
  beforeEach(() => withFontScale(1));
  afterEach(() => jest.restoreAllMocks());

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

  // §22.7 asks for uppercase CTAs but warns off it for long text, so the
  // default and the escape hatch both need to hold.
  it('uppercases the label by default', () => {
    render(<Button label="Order now" onPress={jest.fn()} testID="cta" />);
    expect(screen.getByText('ORDER NOW')).toBeTruthy();
  });

  it('leaves the label alone when asked to preserve case', () => {
    render(<Button label="Need help with this order?" onPress={jest.fn()} preserveCase />);
    expect(screen.getByText('Need help with this order?')).toBeTruthy();
  });

  it('keeps the accessible name in its written case', () => {
    // Uppercase is a visual treatment; a screen reader should not shout.
    render(<Button label="Order now" onPress={jest.fn()} testID="cta" />);
    expect(screen.getByLabelText('Order now')).toBeTruthy();
  });

  // §22.4 gives exact heights, and §22.9 an exact minimum touch target. The
  // small button is deliberately shorter than the target, so the two rules
  // only both hold if the shortfall lands in hitSlop.
  //
  // The spec height is expressed as `minHeight` rather than `height`. At the
  // normal OS text size the two are identical — nothing inside is taller — but
  // a customer who has enlarged their text needs the box to grow instead of
  // clipping the label. A fixed height would honour §22.4 and fail §32.
  it.each([
    ['lg', 56],
    ['md', 44],
    ['sm', 36],
  ] as const)('renders %s at %ipx and still clears 44pt of touch target', (size, height) => {
    render(<Button label="Order now" onPress={jest.fn()} size={size} testID="cta" />);

    const style = buttonStyle('cta');
    expect(style.minHeight).toBe(height);
    // Nothing may cap it back to a fixed box.
    expect(style.height).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();

    const slop = screen.getByTestId('cta').props.hitSlop as { top: number; bottom: number };
    expect(height + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('keeps the label on one line at the normal text size', () => {
    render(<Button label="Track this order" onPress={jest.fn()} testID="cta" />);
    expect(screen.getByText('TRACK THIS ORDER').props.numberOfLines).toBe(1);
  });

  it('caps how far a label follows the OS text size', () => {
    // Uncapped, a 16pt CTA label at iOS's largest accessibility size is 50pt.
    render(<Button label="Order now" onPress={jest.fn()} testID="cta" />);
    expect(screen.getByText('ORDER NOW').props.maxFontSizeMultiplier).toBe(CHROME_FONT_SCALE_CAP);
  });
});

/**
 * With the OS text size turned up.
 *
 * `assets:typefit` measures the bundled Montserrat at 320pt and finds the
 * tightest CTA has 1.07× of horizontal headroom on one line — so no useful cap
 * keeps every label on one line. The button gives the label a second line and
 * lets the box grow instead of choosing between truncation and refusing to
 * scale.
 */
describe('Button at an enlarged text size', () => {
  beforeEach(() => withFontScale(1.6));
  afterEach(() => jest.restoreAllMocks());

  it('lets the label take a second line rather than truncating it', () => {
    render(<Button label="Track this order" onPress={jest.fn()} testID="cta" />);
    expect(screen.getByText('TRACK THIS ORDER').props.numberOfLines).toBe(2);
  });

  it('keeps the spec height as a floor, so the box can grow', () => {
    render(<Button label="Track this order" onPress={jest.fn()} size="lg" testID="cta" />);

    const style = buttonStyle('cta');
    expect(style.minHeight).toBe(56);
    expect(style.paddingVertical).toBeGreaterThan(0);
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
    render(<QuantityStepper quantity={businessRules.maxQuantityPerLine} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('NutritionPanel', () => {
  const nutrition = { kilojoules: 2480, protein: 44, carbs: 32, fat: 34 };

  // The figures are hidden from assistive tech on purpose — the panel carries
  // one composed label instead — so these queries have to opt into hidden
  // elements. Finding them without that flag would mean the panel was
  // announcing eight loose fragments.
  const visible = { includeHiddenElements: true } as const;

  it('shows all four figures with their units', () => {
    render(<NutritionPanel nutrition={nutrition} serves="Serves 2 – 3" />);

    // A space, not a comma: en-ZA groups thousands with a space, and this
    // comes from the app's own formatter rather than Intl.
    expect(screen.getByText('2 480 kJ', visible)).toBeTruthy();
    expect(screen.getByText('44 g', visible)).toBeTruthy();
    expect(screen.getByText('32 g', visible)).toBeTruthy();
    expect(screen.getByText('34 g', visible)).toBeTruthy();
  });

  it('reads as one sentence rather than eight loose fragments', () => {
    render(<NutritionPanel nutrition={nutrition} serves="Serves 2 – 3" />);
    expect(
      screen.getByLabelText(
        'Nutrition, serves 2 – 3. Energy 2 480 kJ, Protein 44 g, Carbs 32 g, Fat 34 g.',
      ),
    ).toBeTruthy();
  });
});

describe('OrderTimeline', () => {
  const timeline = [
    {
      status: 'received' as const,
      label: 'Received',
      description: 'We have your order.',
      occurredAt: '2026-08-22T10:15:00.000Z',
    },
    {
      status: 'preparing' as const,
      label: 'Preparing',
      description: 'Your order is with the kitchen.',
      occurredAt: '2026-08-22T10:20:00.000Z',
    },
    {
      status: 'ready' as const,
      label: 'Ready',
      description: 'Waiting for the driver.',
      occurredAt: null,
    },
  ];

  // §32.4: colour must never be the only thing carrying meaning. Sighted users
  // read the state off a filled node; everyone else needs it in words.
  it('says in words whether each step is done, current or still to come', () => {
    render(<OrderTimeline timeline={timeline} currentStatus="preparing" />);

    expect(screen.getByLabelText(/Received, done at/)).toBeTruthy();
    expect(screen.getByLabelText(/Preparing, in progress now/)).toBeTruthy();
    expect(screen.getByLabelText(/Ready, not yet/)).toBeTruthy();
  });

  it('announces each step as one element, with its position', () => {
    render(<OrderTimeline timeline={timeline} currentStatus="preparing" />);
    expect(screen.getByLabelText(/^Step 2 of 3\. Preparing/)).toBeTruthy();
  });
});

describe('FoodImage', () => {
  it('labels a supplied asset with its product name', () => {
    render(<FoodImage assetKey="goldenOriginal" variant="card" />);
    expect(hasFoodAsset('goldenOriginal')).toBe(true);
    expect(screen.getByLabelText('Golden Original Chicken')).toBeTruthy();
  });

  it("labels a substituted product with its own name, not the stand-in's", () => {
    const pending = PENDING_ASSET_KEYS.find(isSubstituted);
    if (!pending) return; // Every product has its own artwork now.

    render(<FoodImage assetKey={pending} variant="card" />);
    // The photo is borrowed, but the alt text must describe what was ordered.
    expect(screen.getByLabelText(FOOD_ASSET_LABELS[pending])).toBeTruthy();
  });
});
