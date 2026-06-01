"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shouldUsePreviewAPIMode = shouldUsePreviewAPIMode;
var _reactNative = require("react-native");
/**
 * Detects if the app is running in an environment where native modules are not available
 * (like Expo Go or Web) or if the required native modules are missing.
 *
 * @returns {boolean} True if the app is running in an environment where native modules are not available
 * (like Expo Go or Web) or if the required native modules are missing.
 */
function shouldUsePreviewAPIMode() {
  if (isExpoGo()) {
    console.log('Expo Go app detected. Using RevenueCat in Preview API Mode.');
    return true;
  } else if (isRorkSandbox()) {
    console.log('Rork app detected. Using RevenueCat in Preview API Mode.');
    return true;
  } else if (isWebPlatform()) {
    console.log('Web platform detected. Using RevenueCat in Preview API Mode.');
    return true;
  } else {
    return false;
  }
}
/**
 * Detects if the app is running in Expo Go
 */
function isExpoGo() {
  var _globalThis$expo;
  if (!!_reactNative.NativeModules.RNPaywalls && !!_reactNative.NativeModules.RNCustomerCenter) {
    return false;
  }
  return !!((_globalThis$expo = globalThis.expo) !== null && _globalThis$expo !== void 0 && (_globalThis$expo = _globalThis$expo.modules) !== null && _globalThis$expo !== void 0 && _globalThis$expo.ExpoGo);
}

/**
 * Detects if the app is running in the Rork app
 */
function isRorkSandbox() {
  return !!_reactNative.NativeModules.RorkSandbox;
}

/**
 * Detects if the app is running on web platform
 */
function isWebPlatform() {
  return _reactNative.Platform.OS === 'web';
}
//# sourceMappingURL=environment.js.map