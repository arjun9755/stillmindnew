import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { Platform } from "react-native";

const API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || "";
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || "";

export const PRODUCT_IDS = {
  PRO_MONTHLY:  process.env.EXPO_PUBLIC_RC_PRODUCT_PRO_MONTHLY  || "stillmind_pro_monthly",
  PRO_YEARLY:   process.env.EXPO_PUBLIC_RC_PRODUCT_PRO_YEARLY   || "stillmind.pro.yearly",
  PREMIUM_LIFE: process.env.EXPO_PUBLIC_RC_PRODUCT_PREMIUM_LIFE || "stillmind.premium.lifetime",
};

export const PLAN_IDS = {
  PRO:      "pro",
  LIFETIME: "premium_lifetime",
};

let _initialized = false;

export function isRevenueCatConfigured() {
  return Platform.OS === "android"
    ? Boolean(API_KEY_ANDROID)
    : Boolean(API_KEY_IOS);
}

export async function initializeRevenueCat(userId) {
  try {
    if (!isRevenueCatConfigured()) {
      console.warn("[RevenueCat] Nicht konfiguriert: API-Key fehlt.");
      return false;
    }

    if (_initialized) {
      return true;
    }

    try {
      await Purchases.setLogLevel(LOG_LEVEL.WARN);
    } catch (e) {
      console.warn("[RevenueCat] setLogLevel fehlgeschlagen:", (e && e.message) || e);
    }

    const apiKey = Platform.OS === "android" ? API_KEY_ANDROID : API_KEY_IOS;

    if (!apiKey) {
      console.warn("[RevenueCat] Kein API-Key verfügbar.");
      return false;
    }

    await Purchases.configure({
      apiKey: apiKey,
      appUserID: userId || undefined,
    });

    _initialized = true;
    return true;
  } catch (error) {
    console.warn("[RevenueCat] Initialisierung fehlgeschlagen:", (error && error.message) || error);
    return false;
  }
}

export async function getCustomerInfo() {
  try {
    if (!isRevenueCatConfigured()) {
      return null;
    }

    await initializeRevenueCat();
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.warn("[RevenueCat] getCustomerInfo fehlgeschlagen:", (error && error.message) || error);
    return null;
  }
}

export async function getOfferings() {
  try {
    if (!isRevenueCatConfigured()) {
      return null;
    }

    await initializeRevenueCat();
    const offerings = await Purchases.getOfferings();

    if (!offerings) {
      return null;
    }

    return offerings;
  } catch (error) {
    console.warn("[RevenueCat] getOfferings fehlgeschlagen:", (error && error.message) || error);
    return null;
  }
}

export async function getPackageByIdentifier(identifier) {
  try {
    let offerings;
    let currentPackages;
    let directMatch;
    let allOfferings;
    let key;
    let packages;
    let match;

    if (!identifier) {
      return null;
    }

    offerings = await getOfferings();
    if (!offerings) {
      return null;
    }

    currentPackages =
      (offerings.current && offerings.current.availablePackages) || [];

    directMatch = currentPackages.find(function (pkg) {
      return pkg && pkg.identifier === identifier;
    });

    if (directMatch) {
      return directMatch;
    }

    allOfferings = offerings.all || {};
    for (key of Object.keys(allOfferings)) {
      packages = (allOfferings[key] && allOfferings[key].availablePackages) || [];
      match = packages.find(function (pkg) {
        return pkg && pkg.identifier === identifier;
      });
      if (match) {
        return match;
      }
    }

    return null;
  } catch (error) {
    console.warn("[RevenueCat] getPackageByIdentifier fehlgeschlagen:", (error && error.message) || error);
    return null;
  }
}

export async function purchasePackage(pkg) {
  try {
    let result;
    let productIdentifier;

    if (!pkg) {
      return {
        success: false,
        error: "Kein Paket übergeben.",
      };
    }

    if (!isRevenueCatConfigured()) {
      return {
        success: false,
        error: "RevenueCat ist nicht konfiguriert.",
      };
    }

    await initializeRevenueCat();
    result = await Purchases.purchasePackage(pkg);

    productIdentifier =
      (result && result.productIdentifier) ||
      (pkg.product && pkg.product.identifier) ||
      null;

    return {
      success: true,
      customerInfo: (result && result.customerInfo) || null,
      productIdentifier: productIdentifier,
    };
  } catch (error) {
    const code = (error && error.code) || "";
    const userCancelled =
      code === "PURCHASES_ERROR_CODE_PURCHASE_CANCELLED_ERROR" ||
      code === "1" ||
      (error && error.userCancelled) === true;

    if (userCancelled) {
      return {
        success: false,
        cancelled: true,
        error: "Kauf abgebrochen.",
      };
    }

    return {
      success: false,
      error: (error && error.message) || "Kauf fehlgeschlagen.",
    };
  }
}

export async function purchaseConsumable(pkg) {
  return await purchasePackage(pkg);
}

export async function restorePurchases() {
  try {
    let customerInfo;

    if (!isRevenueCatConfigured()) {
      return {
        success: false,
        error: "RevenueCat ist nicht konfiguriert.",
      };
    }

    await initializeRevenueCat();
    customerInfo = await Purchases.restorePurchases();

    return {
      success: true,
      customerInfo: customerInfo,
    };
  } catch (error) {
    return {
      success: false,
      error: (error && error.message) || "Wiederherstellung fehlgeschlagen.",
    };
  }
}

export async function checkPremiumStatus() {
  try {
    let customerInfo;
    let activeEntitlements;
    let entitlementKeys;
    let normalizedKeys;
    let isPremiumLife;
    let isPro;
    let planId;

    customerInfo = await getCustomerInfo();

    if (!customerInfo) {
      return {
        isPremium: false,
        planId: null,
        isLifetime: false,
        isPro: false,
        entitlements: {},
        customerInfo: null,
      };
    }

    activeEntitlements =
      (customerInfo.entitlements && customerInfo.entitlements.active) || {};

    entitlementKeys = Object.keys(activeEntitlements);
    normalizedKeys = entitlementKeys.map(function (key) {
      return String(key).toLowerCase();
    });

    isPremiumLife =
      normalizedKeys.includes("premium_life");

    isPro =
      normalizedKeys.includes("pro");

    // Kein sofortiger Entzug bei Trial-Kündigung — RevenueCat deaktiviert das
    // Entitlement automatisch nach Ablauf der 7 Tage. Wir prüfen nur ob das
    // Entitlement wirklich aktiv ist (nicht abgelaufen).
    // Falls zukünftig Sofort-Sperre gewünscht:
    // var proEnt = activeEntitlements["pro"] || null;
    // if (isPro && proEnt && proEnt.periodType === "trial" && proEnt.willRenew === false) { isPro = false; }

    planId = null;

    if (isPremiumLife) {
      planId = "premium_lifetime";
    } else if (isPro) {
      planId = "pro";
    }

    return {
      isPremium: isPremiumLife || isPro,
      planId: planId,
      isLifetime: isPremiumLife,
      isPro: isPro,
      entitlements: activeEntitlements,
      customerInfo: customerInfo,
    };
  } catch (error) {
    console.warn("[RevenueCat] checkPremiumStatus fehlgeschlagen:", (error && error.message) || error);

    return {
      isPremium: false,
      planId: null,
      isLifetime: false,
      isPro: false,
      entitlements: {},
      customerInfo: null,
    };
  }
}