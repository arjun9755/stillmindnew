"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isToastAction = isToastAction;
function isToastAction(action) {
  return action?.onClick !== undefined;
}
//# sourceMappingURL=types.js.map