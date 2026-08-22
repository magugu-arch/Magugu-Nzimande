import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

/**
 * Credentials live in the platform keychain, never in AsyncStorage.
 *
 * AsyncStorage is a plain unencrypted file. It is the right home for a display
 * name and a notification preference, and the wrong home for a bearer token —
 * it survives into device backups and is readable on a rooted handset. The
 * split is enforced by `partialize`, which is easy to forget when a field is
 * added to the store, and silent when you do.
 */
describe('auth token storage', () => {
  const store = read('src/store/authStore.ts');

  const persisted = (() => {
    const block = /partialize: \(state\) => \(\{([\s\S]*?)\}\),/.exec(store);
    if (!block?.[1]) throw new Error('Could not find partialize in authStore.ts');
    return block[1]
      .split('\n')
      .map((line) => line.trim().split(':')[0] ?? '')
      .filter((key) => /^\w+$/.test(key));
  })();

  it('persists only the fields it means to', () => {
    expect(persisted.sort()).toEqual([
      'hasCompletedOnboarding',
      'isAuthenticated',
      'isGuest',
      'notificationPreferences',
      'preferences',
      'user',
    ]);
  });

  it('lets nothing token-shaped into the AsyncStorage slice', () => {
    for (const key of persisted) {
      expect(key.toLowerCase()).not.toMatch(/token|secret|credential|password/);
    }
  });

  it('reads and writes tokens through expo-secure-store only', () => {
    const secure = read('src/services/secureStorage.ts');
    expect(secure).toContain("from 'expo-secure-store'");

    // The API client must take its bearer from the keychain, not the store.
    const client = read('src/services/apiClient.ts');
    expect(client).toContain("from './secureStorage'");
    expect(client).not.toMatch(/AsyncStorage/);
  });
});

/**
 * Anything named EXPO_PUBLIC_* is inlined into the JavaScript bundle by Expo's
 * Babel plugin, which means it ships to every device and can be read out of the
 * app. That is fine for a publishable key and fatal for a secret one.
 */
describe('only publishable values reach the bundle', () => {
  // Comments are stripped first: this file documents the dynamic-lookup trap
  // by writing it out, and a scanner that reads prose as code finds it there.
  const config = read('src/constants/config.ts')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('reads every environment variable as a literal', () => {
    // Expo inlines `process.env.NAME` and nothing else — a computed lookup
    // like process.env[key] compiles to undefined on device, which is how this
    // silently shipped a broken config once already.
    const dynamic = /process\.env\[/.test(config);
    expect(dynamic).toBe(false);
  });

  it('exposes no variable whose name implies a secret', () => {
    const names = [...config.matchAll(/process\.env\.(EXPO_PUBLIC_\w+)/g)].map((m) => m[1]!);
    expect(names.length).toBeGreaterThan(4);

    for (const name of names) {
      // "PUBLIC_KEY" is the gateway's publishable key and belongs here;
      // a private or secret key never does.
      expect(name).not.toMatch(/SECRET|PRIVATE|_PASSWORD|CLIENT_SECRET/);
    }
  });

  it('reads nothing outside the EXPO_PUBLIC_ namespace', () => {
    const all = [...config.matchAll(/process\.env\.(\w+)/g)].map((m) => m[1]!);
    for (const name of all) {
      expect(name.startsWith('EXPO_PUBLIC_')).toBe(true);
    }
  });

  it('ships no .env file, only the example', () => {
    const tracked = fs.readdirSync(root).filter((f) => f.startsWith('.env'));
    expect(tracked).toEqual(['.env.example']);
  });
});

/**
 * Card details must never touch our own code. The moment a card number passes
 * through this app, PCI compliance scope becomes ours.
 */
describe('card capture stays with the gateway', () => {
  it('has no card number, CVV or expiry field anywhere in the app', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf8');
          if (/\b(cardNumber|cvv|cvc|securityCode|pan)\b/i.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(path.join(root, 'src'));

    expect(offenders).toEqual([]);
  });
});
