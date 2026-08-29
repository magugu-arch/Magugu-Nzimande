import { a11yState } from '@/utils/a11yState';

/**
 * Which attribute carries a control's state, and on which role.
 *
 * The app said all of this through React Native's `accessibilityState`, which
 * React Native Web 0.21 does not map: `/account/preferences` rendered eighteen
 * switches with names and roles and *zero* state attributes between them. A
 * screen reader announced "Order updates, switch" and could not say whether
 * order updates were on — before or after being toggled.
 *
 * The first fix was worse than the bug: it emitted `aria-selected` for every
 * `selected`, which is only meaningful on tab, option, row, gridcell and
 * treeitem. None of the app's selectable things are those — a card, a chip and
 * a favourite heart are toggle buttons, and a fulfilment choice is a radio. On
 * a button `aria-selected` is ignored, so it reads as confidently wrong rather
 * than silent. Hence the role argument, and hence this file.
 */
describe('saying a control’s state in both dialects', () => {
  it('keeps the native prop, which is what VoiceOver and TalkBack read', () => {
    // The web attributes are additions, not a replacement: dropping this would
    // fix the browser and break both platforms the app actually ships to.
    expect(a11yState({ checked: true }, 'switch').accessibilityState).toEqual({ checked: true });
  });

  it('gives a switch, radio and checkbox aria-checked', () => {
    for (const role of ['switch', 'radio', 'checkbox'] as const) {
      expect(a11yState({ checked: false }, role)).toMatchObject({ 'aria-checked': false });
    }
  });

  it('calls a selected button pressed, not selected', () => {
    const props = a11yState({ selected: true }, 'button');
    expect(props['aria-pressed']).toBe(true);
    expect(props['aria-selected']).toBeUndefined();
  });

  it('calls a selected radio checked, not selected', () => {
    const props = a11yState({ selected: true }, 'radio');
    expect(props['aria-checked']).toBe(true);
    expect(props['aria-selected']).toBeUndefined();
  });

  it('uses aria-selected only where it means something', () => {
    expect(a11yState({ selected: true }, 'tab')['aria-selected']).toBe(true);
  });

  it('defaults to button, the role most of these controls take', () => {
    expect(a11yState({ selected: true })['aria-pressed']).toBe(true);
  });

  /**
   * `aria-checked="false"` announces "unchecked", so an element that is not
   * checkable must carry no such attribute rather than a false one. Spreading
   * `false` for every unused state would relabel every button in the app.
   */
  it('omits a state rather than saying false about it', () => {
    const props = a11yState({ disabled: true }, 'button');
    expect(props).toEqual({
      accessibilityState: { disabled: true },
      'aria-disabled': true,
    });
    expect('aria-checked' in props).toBe(false);
    expect('aria-pressed' in props).toBe(false);
  });

  it('carries busy, which is how a placing-order button says it is working', () => {
    expect(a11yState({ disabled: true, busy: true }, 'button')).toMatchObject({
      'aria-busy': true,
      'aria-disabled': true,
    });
  });

  it('distinguishes false from absent', () => {
    // A closed accordion is expanded:false, not "no expanded state" — the
    // difference between "collapsed" and a control that does not expand.
    expect(a11yState({ expanded: false }, 'button')['aria-expanded']).toBe(false);
    expect('aria-expanded' in a11yState({}, 'button')).toBe(false);
  });
});
