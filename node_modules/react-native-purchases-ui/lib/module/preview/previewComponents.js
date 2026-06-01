import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
export const PreviewPaywall = ({
  displayCloseButton = true,
  fontFamily,
  onDismiss
}) => {
  const handleClose = () => {
    onDismiss === null || onDismiss === void 0 || onDismiss();
  };
  const textStyle = fontFamily ? {
    fontFamily
  } : undefined;
  return /*#__PURE__*/React.createElement(View, {
    style: styles.container
  }, /*#__PURE__*/React.createElement(View, {
    style: styles.header
  }, /*#__PURE__*/React.createElement(Text, {
    style: [styles.title, textStyle]
  }, "Preview Paywall"), displayCloseButton && /*#__PURE__*/React.createElement(TouchableOpacity, {
    onPress: handleClose,
    style: styles.closeButton
  }, /*#__PURE__*/React.createElement(Text, {
    style: styles.closeButtonText
  }, "\u2715"))), /*#__PURE__*/React.createElement(View, {
    style: styles.content
  }, /*#__PURE__*/React.createElement(Text, {
    style: [styles.notSupportedMessage, textStyle]
  }, "Web paywalls are not supported yet."), /*#__PURE__*/React.createElement(Text, {
    style: [styles.fakeMessage, textStyle]
  }, "This is a fake preview implementation."), /*#__PURE__*/React.createElement(Text, {
    style: [styles.previewMode, textStyle]
  }, "Currently in preview mode"), /*#__PURE__*/React.createElement(TouchableOpacity, {
    style: styles.closePaywallButton,
    onPress: handleClose
  }, /*#__PURE__*/React.createElement(Text, {
    style: [styles.closePaywallButtonText, textStyle]
  }, "Close Paywall"))));
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 400,
    maxHeight: 600
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333'
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666666'
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  notSupportedMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16
  },
  fakeMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8
  },
  previewMode: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 32
  },
  closePaywallButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center'
  },
  closePaywallButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  description: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center'
  },
  optionButton: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center'
  },
  optionButtonText: {
    fontSize: 16,
    color: '#333333'
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
  },
  disclaimer: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center'
  }
});
export const PreviewCustomerCenter = ({
  style,
  onDismiss
}) => {
  const handleClose = () => {
    onDismiss === null || onDismiss === void 0 || onDismiss();
  };
  return /*#__PURE__*/React.createElement(View, {
    style: [styles.container, style]
  }, /*#__PURE__*/React.createElement(View, {
    style: styles.header
  }, /*#__PURE__*/React.createElement(Text, {
    style: [styles.title]
  }, "Preview Customer Center"), /*#__PURE__*/React.createElement(TouchableOpacity, {
    onPress: handleClose,
    style: styles.closeButton
  }, /*#__PURE__*/React.createElement(Text, {
    style: styles.closeButtonText
  }, "\u2715"))), /*#__PURE__*/React.createElement(View, {
    style: styles.content
  }, /*#__PURE__*/React.createElement(Text, {
    style: [styles.notSupportedMessage]
  }, "Web customer center is not supported yet."), /*#__PURE__*/React.createElement(Text, {
    style: [styles.fakeMessage]
  }, "This is a fake preview implementation."), /*#__PURE__*/React.createElement(Text, {
    style: [styles.previewMode]
  }, "Currently in preview mode"), /*#__PURE__*/React.createElement(TouchableOpacity, {
    style: styles.closePaywallButton,
    onPress: handleClose
  }, /*#__PURE__*/React.createElement(Text, {
    style: [styles.closePaywallButtonText]
  }, "Close Customer Center"))));
};
//# sourceMappingURL=previewComponents.js.map