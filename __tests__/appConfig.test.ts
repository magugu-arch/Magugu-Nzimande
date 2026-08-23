import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

interface AppConfig {
  expo: {
    name: string;
    slug: string;
    scheme: string;
    icon: string;
    ios: { bundleIdentifier: string; infoPlist: Record<string, unknown> };
    android: {
      package: string;
      permissions: string[];
      blockedPermissions?: string[];
      adaptiveIcon: Record<string, string>;
    };
    plugins: (string | [string, Record<string, unknown>])[];
    [key: string]: unknown;
  };
}

const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')) as AppConfig;
const { expo } = config;

function plugin(name: string) {
  const found = expo.plugins.find((p) => (Array.isArray(p) ? p[0] === name : p === name));
  return Array.isArray(found) ? found[1] : found;
}

describe('identity', () => {
  it('uses the same reverse-DNS id on both platforms', () => {
    expect(expo.ios.bundleIdentifier).toBe('za.co.bbqchicken.app');
    expect(expo.android.package).toBe(expo.ios.bundleIdentifier);
  });

  it('claims a deep-link scheme, which push tap routing depends on', () => {
    expect(expo.scheme).toBe('bbqchicken');
  });
});

/**
 * Permissions are what a store reviewer reads first, and the list grows on its
 * own: Expo's Android template adds SYSTEM_ALERT_WINDOW, and expo-image asks
 * for external storage. This app needs neither — it never draws over other
 * apps and never touches the user's files.
 */
describe('android permissions stay minimal', () => {
  it('asks for location and nothing else', () => {
    expect(expo.android.permissions).toEqual(['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']);
  });

  it('strips the three the toolchain adds unasked', () => {
    expect(expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ]),
    );
  });
});

describe('ios configuration', () => {
  it('meets the SDK 57 deployment floor', () => {
    const props = plugin('expo-build-properties') as { ios: { deploymentTarget: string } };
    const [major, minor] = props.ios.deploymentTarget.split('.').map(Number);
    expect(major! * 100 + (minor ?? 0)).toBeGreaterThanOrEqual(16 * 100 + 4);
  });

  it('declares no background modes it does not use', () => {
    // Apple rejects apps that claim remote-notification without silent pushes,
    // and every notification this app sends is user-facing.
    expect(expo.ios.infoPlist.UIBackgroundModes).toBeUndefined();
  });

  it('answers the export-compliance question, so submission does not stall', () => {
    expect(expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('explains why it wants location, in words a person would accept', () => {
    const reason = expo.ios.infoPlist.NSLocationWhenInUseUsageDescription as string;
    expect(reason.length).toBeGreaterThan(30);
    expect(reason).toMatch(/bb\.q/);
  });

  /**
   * Four purpose strings the app never earns.
   *
   * `expo prebuild` showed the built Info.plist asking for Face ID, always-on
   * location and motion activity, each with the plugin's own boilerplate:
   * "Allow $(PRODUCT_NAME) to access your Face ID biometric data." None of it
   * was visible from app.json — the plugins add these by default, and only
   * the when-in-use string had ever been configured.
   *
   * Apple rejects generic purpose strings and scrutinises always-on location
   * hard, so a chicken app asking for it is a review conversation nobody
   * wants. Each `false` deletes the key rather than rewording it.
   */
  describe('asks for nothing it does not use', () => {
    const location = plugin('expo-location') as Record<string, unknown>;

    it('wants location only while the app is open', () => {
      // The store finder calls requestForegroundPermissionsAsync and nothing
      // in the app ever asks for background location.
      expect(location.locationAlwaysAndWhenInUsePermission).toBe(false);
      expect(location.locationAlwaysPermission).toBe(false);
    });

    it('does not claim the motion coprocessor', () => {
      expect(location.motionUsagePermission).toBe(false);
    });

    it('does not claim Face ID', () => {
      // Secure storage here holds tokens, and never passes
      // `requiresAuthentication`, so no biometric prompt is ever shown.
      const secureStore = plugin('expo-secure-store') as Record<string, unknown>;
      expect(secureStore.faceIDPermission).toBe(false);
    });
  });
});

describe('every asset app.json names exists', () => {
  const referenced = [
    expo.icon,
    ...Object.values(expo.android.adaptiveIcon).filter((v) => v.startsWith('./')),
    (plugin('expo-notifications') as { icon: string }).icon,
    (plugin('expo-splash-screen') as { image: string }).image,
  ];

  it.each(referenced)('%s', (file) => {
    expect(fs.existsSync(path.join(root, file))).toBe(true);
  });
});

describe('eas configuration', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')) as {
    cli: { appVersionSource: string };
    build: Record<string, { env?: Record<string, string>; distribution?: string }>;
  };

  it('lets EAS own the build number', () => {
    // Otherwise two builds from different machines collide on version code.
    expect(eas.cli.appVersionSource).toBe('remote');
  });

  it('ships production against the real API, not the mock', () => {
    expect(eas.build.production?.env?.EXPO_PUBLIC_USE_MOCK_API).toBe('0');
    expect(eas.build.production?.distribution).toBe('store');
  });

  it('keeps the mock on for the profile stakeholders review', () => {
    expect(eas.build.preview?.env?.EXPO_PUBLIC_USE_MOCK_API).toBe('1');
  });

  /**
   * Belt as well as braces. The profiles above set the value explicitly, but
   * the source default is what governs any build that does not — and it used
   * to be plain `true`, so a release build that forgot the variable would have
   * reached a store quoting invented prices and accepting orders no kitchen
   * would ever see, silently, because a fake backend never errors.
   *
   * Read as source rather than imported: `__DEV__` is true under Jest, so
   * evaluating `config.useMockApi` here would report the development answer
   * and prove nothing about a release build.
   */
  it('never falls back to the mock layer in a release build', () => {
    const source = fs.readFileSync(path.join(root, 'src/constants/config.ts'), 'utf8');
    const fallback = /useMockApi:\s*bool\(\s*process\.env\.EXPO_PUBLIC_USE_MOCK_API,\s*([^)]+)\)/
      .exec(source)?.[1]
      ?.trim();

    expect(fallback).toBe('__DEV__');
  });

  it('lets every profile name its own answer, rather than relying on that', () => {
    for (const [name, profile] of Object.entries(eas.build)) {
      if (name === 'base') continue;
      // Inherited through `extends` counts; only a profile that names neither
      // itself nor a parent is trusting the default.
      const chain = [
        profile.env?.EXPO_PUBLIC_USE_MOCK_API,
        eas.build.base?.env?.EXPO_PUBLIC_USE_MOCK_API,
      ];
      const named =
        chain.some((v) => v !== undefined) ||
        Boolean(
          eas.build[(profile as { extends?: string }).extends ?? '']?.env?.EXPO_PUBLIC_USE_MOCK_API,
        );
      expect(named).toBe(true);
    }
  });
});
