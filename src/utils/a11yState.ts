/**
 * A control's state, said in both dialects.
 *
 * React Native's cross-platform API for this is `accessibilityState`, and every
 * stateful control in the app sets it. React Native Web 0.21 does not map it:
 * on `/account/preferences` all eighteen switches carried `role="switch"` and a
 * name, and not one carried `aria-checked` — the whole screen had zero elements
 * with any state attribute at all. A screen reader announced "Order updates,
 * switch" and could not say whether order updates were on, before or after
 * being toggled. The same held for the menu's category chips, the saved-address
 * and store cards, and the help accordions.
 *
 * VoiceOver and TalkBack read the native prop, so this returns both rather than
 * replacing one with the other. Written once because it was about to be written
 * eleven times, and the eleventh would have been the one that drifted.
 *
 * Spread it in place of `accessibilityState`:
 *
 *     <Pressable accessibilityRole="switch" {...a11yState({ checked: value })} />
 */
export interface A11yState {
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

export interface A11yStateProps {
  accessibilityState: A11yState;
  'aria-checked'?: boolean;
  'aria-pressed'?: boolean;
  'aria-selected'?: boolean;
  'aria-expanded'?: boolean;
  'aria-disabled'?: boolean;
  'aria-busy'?: boolean;
}

/** The roles the app actually gives a stateful control. */
export type A11yRole = 'button' | 'radio' | 'checkbox' | 'switch' | 'tab';

/**
 * Which attribute carries "selected", which depends entirely on the role.
 *
 * `aria-selected` is only meaningful on a handful of roles — tab, option, row,
 * gridcell, treeitem — and none of the app's selectable things are those. A
 * selectable card, chip or heart is a toggle button, so it is `aria-pressed`; a
 * fulfilment choice or a payment method declares `role="radio"`, and a radio
 * says `aria-checked`. Putting `aria-selected` on a button would be worse than
 * saying nothing: confidently wrong, and ignored by the reader anyway.
 */
function selectedAttr(role: A11yRole): 'aria-checked' | 'aria-pressed' | 'aria-selected' {
  if (role === 'radio' || role === 'checkbox' || role === 'switch') return 'aria-checked';
  if (role === 'tab') return 'aria-selected';
  return 'aria-pressed';
}

export function a11yState(state: A11yState, role: A11yRole = 'button'): A11yStateProps {
  return {
    // Native reads this one; it is not redundant.
    accessibilityState: state,
    // `undefined` rather than `false` when a state does not apply: an element
    // that is not checkable should carry no `aria-checked` at all, and saying
    // `aria-checked="false"` would announce it as an unchecked control.
    ...(state.checked === undefined ? {} : { 'aria-checked': state.checked }),
    ...(state.selected === undefined ? {} : { [selectedAttr(role)]: state.selected }),
    ...(state.expanded === undefined ? {} : { 'aria-expanded': state.expanded }),
    ...(state.disabled === undefined ? {} : { 'aria-disabled': state.disabled }),
    ...(state.busy === undefined ? {} : { 'aria-busy': state.busy }),
  };
}
