import React from 'react';
import { type ViewStyle, type StyleProp } from 'react-native';
import { type CustomerInfo, type PurchasesError, type PurchasesOffering, type PurchasesPackage, type PurchasesStoreTransaction } from "@revenuecat/purchases-typescript-internal";
export interface PreviewPaywallProps {
    offering?: PurchasesOffering | null;
    displayCloseButton?: boolean;
    fontFamily?: string | null;
    onPurchaseStarted?: ({ packageBeingPurchased }: {
        packageBeingPurchased: PurchasesPackage;
    }) => void;
    onPurchaseCompleted?: ({ customerInfo, storeTransaction }: {
        customerInfo: CustomerInfo;
        storeTransaction: PurchasesStoreTransaction;
    }) => void;
    onPurchaseError?: ({ error }: {
        error: PurchasesError;
    }) => void;
    onPurchaseCancelled?: () => void;
    onRestoreStarted?: () => void;
    onRestoreCompleted?: ({ customerInfo }: {
        customerInfo: CustomerInfo;
    }) => void;
    onRestoreError?: ({ error }: {
        error: PurchasesError;
    }) => void;
    onDismiss?: () => void;
}
export declare const PreviewPaywall: React.FC<PreviewPaywallProps>;
export interface PreviewCustomerCenterProps {
    style?: StyleProp<ViewStyle>;
    onDismiss?: () => void;
}
export declare const PreviewCustomerCenter: React.FC<PreviewCustomerCenterProps>;
//# sourceMappingURL=previewComponents.d.ts.map