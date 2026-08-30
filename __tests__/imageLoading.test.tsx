import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react-native';
import { FoodImage } from '@/components/food/FoodImage';

const root = path.resolve(__dirname, '..');

/**
 * §13: "Lazy-load below-the-fold imagery while prioritising hero and first-view
 * menu assets."
 *
 * Two halves that pull in opposite directions, which is why they are worth
 * holding. `expo-image` defers on web by default, so the below-the-fold half
 * arrived free — and took the hero with it, deferring the one photograph the
 * screen cannot open without. Getting the second half right means *undoing*
 * the default in exactly the places it is wrong, and no others.
 *
 * The props are read off the rendered `expo-image` element rather than
 * asserted against the map, so a change to how the component derives them
 * still has to produce the same behaviour.
 */
function loadPropsFor(props: Parameters<typeof FoodImage>[0]) {
  const tree = render(<FoodImage {...props} testID="subject" />);
  const image = tree.UNSAFE_getByType(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-image') as { Image: React.ComponentType }).Image,
  );
  return image.props as { priority?: string; loading?: string };
}

describe('what loads first', () => {
  it.each([
    ['banner', 'high', 'eager'],
    ['detail', 'high', 'eager'],
  ] as const)('%s is a hero: %s priority, %s', (variant, priority, loading) => {
    const props = loadPropsFor({ assetKey: 'goldenOriginal', variant });
    expect(props.priority).toBe(priority);
    expect(props.loading).toBe(loading);
  });

  it('a catalogue card is ordinary, and still deferred', () => {
    const props = loadPropsFor({ assetKey: 'goldenOriginal', variant: 'card' });
    expect(props.priority).toBe('normal');
    expect(props.loading).toBe('lazy');
  });

  it('a menu-row thumbnail yields to everything else', () => {
    // Small, and almost always below the fold. Arriving late costs nothing.
    const props = loadPropsFor({ assetKey: 'goldenOriginal', variant: 'thumb' });
    expect(props.priority).toBe('low');
    expect(props.loading).toBe('lazy');
  });
});

describe('when the screen knows better than the variant', () => {
  it('promotes a card that sits at the top of a screen', () => {
    const props = loadPropsFor({
      assetKey: 'goldenOriginal',
      variant: 'card',
      aboveTheFold: true,
    });
    expect(props.priority).toBe('high');
    expect(props.loading).toBe('eager');
  });

  /**
   * The case that made the prop decide in both directions. Onboarding draws
   * three `detail` slides in a horizontal carousel: hero-shaped by variant,
   * off-screen by position. Left to the variant they would all load first and
   * eagerly — three full-bleed photographs racing each other on the first
   * screen of the app, on whatever connection the customer has.
   */
  it('demotes a hero-sized image that is not on screen yet', () => {
    const props = loadPropsFor({
      assetKey: 'goldenOriginal',
      variant: 'detail',
      aboveTheFold: false,
    });
    expect(props.priority).toBe('low');
    expect(props.loading).toBe('lazy');
  });
});

describe('the onboarding carousel uses it', () => {
  it('marks only the first slide as on screen', () => {
    // Asserted against the source: a rendered test would need the FlatList to
    // virtualise, and what matters is that the index is what decides.
    const welcome = fs.readFileSync(
      path.join(root, 'src', 'app', '(onboarding)', 'welcome.tsx'),
      'utf8',
    );
    expect(welcome).toContain('aboveTheFold={index === 0}');
  });
});
