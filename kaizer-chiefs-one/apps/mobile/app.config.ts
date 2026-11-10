import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App identity is a placeholder until the club confirms the store listing,
 * bundle identifiers and approved icon. The name says "Concept" so a test
 * build on someone's phone can never be mistaken for an official app.
 */
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'local';
const isProduction = APP_ENV === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProduction ? 'Kaizer Chiefs One' : 'KC One (Concept)',
  slug: 'kc-one-concept',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'kcone',
  userInterfaceStyle: 'dark',
  icon: './assets/brand/icon.png',
  backgroundColor: '#101010',
  ios: {
    supportsTablet: true,
    // Placeholder. Replace with the club's own identifier before any store build.
    bundleIdentifier: 'org.example.kcone.concept',
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: 'org.example.kcone.concept',
    adaptiveIcon: {
      backgroundColor: '#101010',
      foregroundImage: './assets/brand/android-icon-foreground.png',
    },
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/brand/favicon.png',
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/brand/splash-icon.png',
        imageWidth: 180,
        backgroundColor: '#101010',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Choose a photo or video to share as a Fan Moment. Nothing is shared until you review and submit it.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
});
