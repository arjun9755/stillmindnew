import { PurchasesCommon } from "@revenuecat/purchases-js-hybrid-mappings";
/**
 * Preview implementation of the native module for Preview API mode, i.e. for environments where native modules are not available
 * (like Expo Go).
 */
export const previewNativeModuleRNPaywalls = {
  presentPaywall: async (offeringIdentifier, presentedOfferingContext, _displayCloseButton, _fontFamily) => {
    return await PurchasesCommon.getInstance().presentPaywall({
      offeringIdentifier,
      presentedOfferingContext
    });
  },
  presentPaywallIfNeeded: async (requiredEntitlementIdentifier, offeringIdentifier, presentedOfferingContext, _displayCloseButton, _fontFamily) => {
    return await PurchasesCommon.getInstance().presentPaywall({
      requiredEntitlementIdentifier,
      offeringIdentifier,
      presentedOfferingContext
    });
  }
};
export const previewNativeModuleRNCustomerCenter = {
  presentCustomerCenter: () => {
    return null;
  }
};
//# sourceMappingURL=nativeModules.js.map