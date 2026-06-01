// modules/stillmind-watch/plugin/index.js
const { withXcodeProject, withInfoPlist } = require("@expo/config-plugins");

const WATCH_APP_NAME = "StillMindWatch";
const WATCH_BUNDLE_ID = "de.stillmind.app.watchkitapp";

/**
 * Adds WatchKit companion app entitlements to the main iOS app.
 * The actual Watch target must be created manually in Xcode.
 * This plugin handles the plist/entitlement side automatically.
 */
const withStillMindWatch = (config) => {
  // Add WatchKit companion key to Info.plist
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.WKCompanionAppBundleIdentifier = "de.stillmind.app";
    cfg.modResults.WKWatchKitApp = true;
    return cfg;
  });

  return config;
};

module.exports = withStillMindWatch;
