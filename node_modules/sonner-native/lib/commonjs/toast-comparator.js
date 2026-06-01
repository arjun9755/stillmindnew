"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.areToastsEqual = void 0;
var _types = require("./types.js");
const areActionsEqual = (a, b) => {
  if ((0, _types.isToastAction)(a) && (0, _types.isToastAction)(b)) {
    if (a.label !== b.label) return false;
    return true;
  }
  return true;
};
const areToastsEqual = (a, b) => {
  return a.id === b.id && a.title === b.title && a.variant === b.variant && a.description === b.description && a.closeButton === b.closeButton && a.invert === b.invert && a.position === b.position && a.dismissible === b.dismissible && areActionsEqual(a.action, b.action) && areActionsEqual(a.cancel, b.cancel);
};
exports.areToastsEqual = areToastsEqual;
//# sourceMappingURL=toast-comparator.js.map