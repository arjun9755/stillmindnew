"use strict";

import { isToastAction } from "./types.js";
const areActionsEqual = (a, b) => {
  if (isToastAction(a) && isToastAction(b)) {
    if (a.label !== b.label) return false;
    return true;
  }
  return true;
};
export const areToastsEqual = (a, b) => {
  return a.id === b.id && a.title === b.title && a.variant === b.variant && a.description === b.description && a.closeButton === b.closeButton && a.invert === b.invert && a.position === b.position && a.dismissible === b.dismissible && areActionsEqual(a.action, b.action) && areActionsEqual(a.cancel, b.cancel);
};
//# sourceMappingURL=toast-comparator.js.map