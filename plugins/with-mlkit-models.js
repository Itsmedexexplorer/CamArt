// Merges the ML Kit model list into the APP manifest. The dev client declares
// barcode_ui and we need subject_segment; only the app manifest can override a
// library's value, so the combined line with tools:replace lives here.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app['meta-data'] = (app['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'com.google.mlkit.vision.DEPENDENCIES');
    app['meta-data'].push({
      $: { 'android:name': 'com.google.mlkit.vision.DEPENDENCIES', 'android:value': 'barcode_ui,subject_segment', 'tools:replace': 'android:value' },
    });
    return cfg;
  });
