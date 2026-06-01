"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.previewNativeModuleRNPaywalls = exports.previewNativeModuleRNCustomerCenter = void 0;
var _purchasesJsHybridMappings = require("@revenuecat/purchases-js-hybrid-mappings");
/**
 * Preview implementation of the native module for Preview API mode, i.e. for environments where native modules are not available
 * (like Expo Go).
 */
const previewNativeModuleRNPaywalls = exports.previewNativeModuleRNPaywalls = {
  presentPaywall: async (offeringIdentifier, presentedOfferingContext, _displayCloseButton, _fontFamily) => {
    return await _purchasesJsHybridMappings.PurchasesCommon.getInstance().presentPaywall({
      offeringIdentifier,
      presentedOfferingContext
    });
  },
  presentPaywallIfNeeded: async (requiredEntitlementIdentifier, offeringIdentifier, presentedOfferingContext, _displayCloseButton, _fontFamily) => {
    return await _purchasesJsHybridMappings.PurchasesCommon.getInstance().presentPaywall({
      requiredEntitlementIdentifier,
      offeringIdentifier,
      presentedOfferingContext
    });
  }
};
const previewNativeModuleRNCustomerCenter = exports.previewNativeModuleRNCustomerCenter = {
  presentCustomerCenter: () => {
    return null;
  }
};
//# sourceMappingURL=nativeModules.js.map