const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * `npm run single:build` sets this to produce one self-contained HTML file.
 * Images and the icon font then compile to JavaScript modules (so nothing is
 * fetched by URL) and the router keeps its address in the URL fragment (so
 * the file works from a phone's storage). Every other build is untouched.
 */
if (process.env.SCARLETS_SINGLE_FILE === '1') {
  const inlined = ['png', 'jpg', 'jpeg', 'webp', 'ttf'];
  config.transformer.babelTransformerPath = require.resolve('../../single/metro-transformer.js');
  config.resolver.assetExts = config.resolver.assetExts.filter((ext) => !inlined.includes(ext));
  config.resolver.sourceExts = [...config.resolver.sourceExts, ...inlined];
  config.cacheVersion = 'scarlets-single-file';
}

module.exports = config;
