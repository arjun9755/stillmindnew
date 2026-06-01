import { useCallback, useEffect, useState } from "react";
import {
  checkPremiumStatus,
  getOfferings,
  initializeRevenueCat,
  purchaseConsumable,
  purchasePackage,
  restorePurchases,
} from "./revenuecat";
import { getCredits } from "./credits-storage";

export default function usePurchases() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [offerings, setOfferings] = useState(null);
  const [availablePackages, setAvailablePackages] = useState([]);

  const [customerInfo, setCustomerInfo] = useState(null);
  const [entitlements, setEntitlements] = useState({});

  const [isPremium, setIsPremium] = useState(false);
  const [isLifetime, setIsLifetime] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [planId, setPlanId] = useState(null);

  const [credits, setCredits] = useState(0);
  const [error, setError] = useState(null);

  const refreshCustomerInfo = useCallback(async function () {
    try {
      var premiumState;
      var currentCredits;

      setError(null);

      premiumState = await checkPremiumStatus();

      setCustomerInfo((premiumState && premiumState.customerInfo) || null);
setEntitlements((premiumState && premiumState.entitlements) || {});
setIsPremium(Boolean(premiumState && premiumState.isPremium));
setIsLifetime(Boolean(premiumState && premiumState.isLifetime));
setIsPro(Boolean(premiumState && premiumState.isPro));
setPlanId((premiumState && premiumState.planId) || null);

      currentCredits = await getCredits();
      setCredits(
        typeof currentCredits === "number" && !isNaN(currentCredits)
          ? currentCredits
          : 0
      );

      return premiumState;
    } catch (err) {
      var message = (err && err.message) || "Kundendaten konnten nicht geladen werden.";
      setError(message);
      return null;
    }
  }, []);

  const loadData = useCallback(async function () {
    try {
      var offeringsData;
      var pkgs;

      setLoading(true);
      setError(null);

      await initializeRevenueCat();

      // Offerings laden
      offeringsData = await getOfferings();
      setOfferings(offeringsData || null);

      // Packages flatten (OHNE optional chaining)
      pkgs =
        (offeringsData && offeringsData.availablePackages) ||
        (offeringsData &&
          offeringsData.current &&
          offeringsData.current.availablePackages) ||
        [];

      if (!Array.isArray(pkgs)) {
        pkgs = [];
      }

      setAvailablePackages(pkgs);

      // Premium + Credits laden
      await refreshCustomerInfo();
    } catch (err) {
      var message = (err && err.message) || "Purchases konnten nicht geladen werden.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [refreshCustomerInfo]);

  useEffect(function () {
    loadData();
  }, [loadData]);

  const purchase = useCallback(
    async function (pkg) {
      try {
        var result;

        setProcessing(true);
        setError(null);

        result = await purchasePackage(pkg);

        if (!result || !result.success) {
          throw new Error(
            (result && result.error) || "Kauf fehlgeschlagen."
          );
        }

        await refreshCustomerInfo();

        return {
          success: true,
          result: result,
        };
      } catch (err) {
        var message = (err && err.message) || "Kauf fehlgeschlagen.";
        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setProcessing(false);
      }
    },
    [refreshCustomerInfo]
  );

  const purchaseCredits = useCallback(
    async function (pkg) {
      try {
        var result;

        setProcessing(true);
        setError(null);

        result = await purchaseConsumable(pkg);

        if (!result || !result.success) {
          throw new Error(
            (result && result.error) || "Credits-Kauf fehlgeschlagen."
          );
        }

        await refreshCustomerInfo();

        return {
          success: true,
          result: result,
        };
      } catch (err) {
        var message =
          (err && err.message) || "Credits-Kauf fehlgeschlagen.";
        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setProcessing(false);
      }
    },
    [refreshCustomerInfo]
  );

  const restore = useCallback(
    async function () {
      try {
        var result;

        setProcessing(true);
        setError(null);

        result = await restorePurchases();

        if (!result || !result.success) {
          throw new Error(
            (result && result.error) ||
              "Wiederherstellung fehlgeschlagen."
          );
        }

        await refreshCustomerInfo();

        return {
          success: true,
          result: result,
        };
      } catch (err) {
        var message =
          (err && err.message) ||
          "Wiederherstellung fehlgeschlagen.";

        setError(message);

        return {
          success: false,
          error: message,
        };
      } finally {
        setProcessing(false);
      }
    },
    [refreshCustomerInfo]
  );

  const reload = useCallback(
    async function () {
      await loadData();
    },
    [loadData]
  );

  // Sucht ein Paket anhand der Produkt-ID (z.B. PRODUCT_IDS.PRO_MONTHLY)
  const getPackageByProductId = useCallback(
    function (productId) {
      if (!productId || !Array.isArray(availablePackages)) {
        return null;
      }
      return availablePackages.find(function (pkg) {
        return (
          pkg &&
          pkg.product &&
          (pkg.product.identifier === productId ||
            pkg.product.productIdentifier === productId)
        );
      }) || null;
    },
    [availablePackages]
  );

  // Liest den lokalisierten Preis-String aus einem Paket
  function getPriceString(pkg) {
    if (!pkg) return null;
    // RevenueCat stellt den Preis auf verschiedenen Pfaden bereit
    var price =
      (pkg.product && pkg.product.priceString) ||
      (pkg.product && pkg.product.localizedPriceString) ||
      (pkg.storeProduct && pkg.storeProduct.priceString) ||
      null;
    return typeof price === "string" && price.trim() ? price.trim() : null;
  }

  // Alias: buyCredit → purchaseCredits (Erwartung in premium_index & MinutesBubble)
  const buyCredit = purchaseCredits;

  // Alias: refresh → reload (Erwartung in premium_index)
  const refresh = reload;

  return {
    loading: loading,
    processing: processing,
    error: error,

    offerings: offerings,
    availablePackages: availablePackages,

    customerInfo: customerInfo,
    entitlements: entitlements,

    isPremium: isPremium,
    isLifetime: isLifetime,
    isPro: isPro,
    planId: planId,

    credits: credits,

    purchase: purchase,
    purchaseCredits: purchaseCredits,
    buyCredit: buyCredit,
    restore: restore,
    refreshCustomerInfo: refreshCustomerInfo,
    reload: reload,
    refresh: refresh,

    getPackageByProductId: getPackageByProductId,
    getPriceString: getPriceString,
  };
}

export { usePurchases };