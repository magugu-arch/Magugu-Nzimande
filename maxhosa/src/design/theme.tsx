import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';
import { usePrefs } from '@/store/prefs';

type Theme = { colors: Palette; scheme: 'light' | 'dark' };

const ThemeContext = createContext<Theme>({ colors: light, scheme: 'light' });

/** Follows the system appearance unless the customer chose one in Account. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const choice = usePrefs((s) => s.appearance);
  const scheme = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  return (
    <ThemeContext.Provider value={{ colors: scheme === 'dark' ? dark : light, scheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
