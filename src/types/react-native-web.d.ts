/**
 * `dataSet`, which React Native Web accepts and React Native's own types do not
 * declare.
 *
 * It renders as `data-*` attributes on the web build and is ignored on a
 * handset. The app uses it for one thing: telling a browser how much `hitSlop`
 * a control carries.
 *
 * That matters because `hitSlop` is a no-op in React Native Web — only the
 * legacy `Touchable` module ever honoured it — so a control that is 32 points
 * across with 6 points of slop renders as a 32-point box with nothing in the
 * DOM to say the real target is 44. `audit:screens` measures boxes, and without
 * this it would need a hand-written list of which small ones are acceptable:
 * the kind of list that quietly stops matching the code, and then passes.
 *
 * Declared here rather than cast at each call site, because it is a real prop
 * that a real renderer honours.
 */
import 'react-native';

declare module 'react-native/Libraries/Components/Pressable/Pressable' {
  interface PressableProps {
    /** Web only. Rendered as `data-*` attributes; native ignores it. */
    dataSet?: Record<string, string | number | undefined>;
  }
}

declare module 'react-native' {
  interface PressableProps {
    /** Web only. Rendered as `data-*` attributes; native ignores it. */
    dataSet?: Record<string, string | number | undefined>;
  }
  interface ViewProps {
    /** Web only. Rendered as `data-*` attributes; native ignores it. */
    dataSet?: Record<string, string | number | undefined>;
  }
}
