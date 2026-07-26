// Fix: "Uncaught SyntaxError: Cannot use 'import.meta' outside a module" on web,
// which showed as a completely blank page with no React error.
//
// zustand v5 ships an ESM build that uses `import.meta.env` to detect dev mode.
// babel-preset-expo has a transform for this, but it is off by default in SDK 54,
// and its behaviour when disabled is what made this so hard to see
// (node_modules/expo/node_modules/babel-preset-expo/build/import-meta-transform-plugin.js):
//
//     if (!pluginEnabled) {
//       if (platform !== 'web') { throw ... }   // native: clear build error
//       return;                                 // web: leaves import.meta as-is
//     }
//
// So on native you get a loud build failure, while on web the syntax is passed
// through untouched into a bundle served as a classic <script> — where
// `import.meta` is a parse error. The bundle never executes, so no application
// code runs and nothing is logged beyond the one SyntaxError.
//
// Enabling the option rewrites `import.meta` to `globalThis.__ExpoImportMetaRegistry`,
// which expo's winter runtime installs on web (expo/src/winter/runtime.ts) as
// well as native. This becomes the default in SDK 56.
const path = require('path');

// babel-preset-expo is not a direct dependency of this project — it comes in
// under expo, and npm did not hoist it to mobile/node_modules. Babel resolves
// preset names relative to this config file, so the bare string
// 'babel-preset-expo' fails with MODULE_NOT_FOUND, which Metro surfaces as a
// 500 and an "MIME type ('application/json') is not executable" error in the
// browser rather than anything that names the real problem.
//
// Resolve it explicitly instead: prefer a hoisted copy if one exists (a fresh
// install, or CI, may place it at the top level), and otherwise fall back to
// the nested copy under expo.
function resolveExpoPreset() {
  try {
    return require.resolve('babel-preset-expo');
  } catch {
    const expoDir = path.dirname(require.resolve('expo/package.json'));
    return require.resolve('babel-preset-expo', { paths: [expoDir] });
  }
}

module.exports = function (api) {
  api.cache(true);

  return {
    presets: [[resolveExpoPreset(), { unstable_transformImportMeta: true }]],
  };
};
