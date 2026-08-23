#!/usr/bin/env node
/**
 * Check what the native build actually declares.
 *
 * `app.json` is not the whole story. Config plugins add keys of their own, and
 * the ones they add by default are the ones that get an app rejected: this
 * check exists because a prebuild showed the Info.plist asking for Face ID,
 * always-on location and motion activity — none of which the app uses, each
 * carrying the plugin's own boilerplate ("Allow $(PRODUCT_NAME) to access your
 * Face ID biometric data."). Nothing in app.json hinted at any of it.
 *
 * So this runs a real prebuild and reads the generated artifacts. Checking the
 * config would only re-state what someone already wrote down; checking the
 * output catches what the toolchain added on their behalf.
 *
 * Exits non-zero on a finding. Run: npm run audit:native
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = [];

console.log('Running prebuild…');
execFileSync('npx', ['expo', 'prebuild', '--no-install', '--clean'], {
  cwd: root,
  stdio: 'pipe',
});

// --- iOS -------------------------------------------------------------------

const plistPath = fs
  .readdirSync(path.join(root, 'ios'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.endsWith('.xcodeproj'))
  .map((e) => path.join(root, 'ios', e.name, 'Info.plist'))
  .find((p) => fs.existsSync(p));

if (!plistPath) {
  console.error('No Info.plist found — did prebuild run?');
  process.exit(1);
}

const plist = JSON.parse(
  execFileSync(
    'python3',
    ['-c', 'import plistlib,sys,json; print(json.dumps(plistlib.load(open(sys.argv[1],"rb")),default=str))', plistPath],
    { encoding: 'utf8' },
  ),
);

/**
 * Purpose strings the app has no business asking for. Each is added by a
 * plugin default rather than by anything in app.json.
 */
const UNEARNED = [
  'NSFaceIDUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSMotionUsageDescription',
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSContactsUsageDescription',
  'NSCalendarsUsageDescription',
];

for (const key of UNEARNED) {
  if (key in plist) {
    findings.push(`Info.plist declares ${key} — the app does not use it. Suppress it in the plugin config.`);
  }
}

// A purpose string that still contains the plugin's placeholder is one nobody
// has written yet. Apple rejects these on sight.
for (const [key, value] of Object.entries(plist)) {
  if (!key.startsWith('NS') || !key.endsWith('UsageDescription')) continue;
  if (typeof value !== 'string') continue;
  // The dev-client's local-network string is Expo's and never ships in a
  // production build, so it is not ours to rewrite.
  if (key === 'NSLocalNetworkUsageDescription') continue;
  if (value.includes('$(PRODUCT_NAME)')) {
    findings.push(`${key} is still the plugin's placeholder: "${value}"`);
  }
}

if (Array.isArray(plist.UIBackgroundModes) && plist.UIBackgroundModes.length > 0) {
  findings.push(`Info.plist claims background modes: ${plist.UIBackgroundModes.join(', ')}`);
}

// Apple rejects an app icon with an alpha channel outright.
const iconPath = path.join(
  root,
  'ios',
  path.basename(path.dirname(plistPath)),
  'Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png',
);
if (fs.existsSync(iconPath)) {
  const mode = execFileSync(
    'python3',
    ['-c', 'from PIL import Image;import sys;print(Image.open(sys.argv[1]).mode)', iconPath],
    { encoding: 'utf8' },
  ).trim();
  if (mode !== 'RGB') {
    findings.push(`App icon is ${mode}; Apple requires an opaque RGB icon with no alpha.`);
  }
} else {
  findings.push('No 1024×1024 app icon was generated.');
}

// --- Android ---------------------------------------------------------------

const manifest = fs.readFileSync(
  path.join(root, 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
);

/** Permissions that may appear without `tools:node="remove"` beside them. */
const ALLOWED_PERMISSIONS = new Set([
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.INTERNET',
  'android.permission.VIBRATE',
  'android.permission.POST_NOTIFICATIONS',
]);

for (const match of manifest.matchAll(/<uses-permission[^>]*android:name="([^"]+)"([^>]*)>/g)) {
  const [, name, rest] = match;
  if (rest.includes('tools:node="remove"')) continue;
  if (!ALLOWED_PERMISSIONS.has(name)) {
    findings.push(`AndroidManifest requests ${name}, which is not on the allowed list.`);
  }
}

for (const background of ['ACCESS_BACKGROUND_LOCATION', 'FOREGROUND_SERVICE']) {
  if (manifest.includes(background) && !manifest.includes(`${background}" tools:node="remove"`)) {
    findings.push(`AndroidManifest requests ${background} — this app has no background work.`);
  }
}

// --- Report ----------------------------------------------------------------

if (findings.length === 0) {
  const permissions = [...manifest.matchAll(/android:name="(android\.permission\.[^"]+)"/g)]
    .map((m) => m[1].replace('android.permission.', ''))
    .sort();
  console.log(`\niOS purpose strings: ${Object.keys(plist).filter((k) => k.endsWith('UsageDescription')).length}`);
  console.log(`Android permissions: ${permissions.join(', ')}`);
  console.log('\nThe native projects declare nothing the app does not use. Cleared.');
  process.exit(0);
}

console.log(`\n${findings.length} finding(s):\n`);
for (const finding of findings) console.log(`  • ${finding}`);
process.exit(1);
