import type { TextStyle, ViewStyle } from 'react-native';
import type { ToastVariant } from './types';
type DefaultStyles = {
    toast: ViewStyle;
    toastContent: ViewStyle;
    title: TextStyle;
    description: TextStyle;
    buttons: ViewStyle;
    actionButton: ViewStyle;
    actionButtonText: TextStyle;
    cancelButton: ViewStyle;
    cancelButtonText: TextStyle;
    closeButtonColor: string;
    iconColor: string;
};
export declare const useDefaultStyles: ({ invert, richColors, unstyled, description, variant: variantProps, }: {
    invert: boolean;
    richColors: boolean;
    unstyled: boolean | undefined;
    description: string | undefined;
    variant: ToastVariant;
}) => DefaultStyles;
export {};
//# sourceMappingURL=use-default-styles.d.ts.map