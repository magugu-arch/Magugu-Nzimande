import { Platform } from 'react-native';

/**
 * A scrolling area with nothing focusable inside it — a wall of photographs, a
 * page of legal prose, a rail of pictures — cannot be reached with a keyboard
 * on the web. Spreading this makes the area itself a tab stop, which is what
 * WCAG 2.1.1 asks for, and changes nothing on iOS or Android.
 */
export const scrollableByKeyboard = Platform.OS === 'web' ? ({ focusable: true } as const) : {};
