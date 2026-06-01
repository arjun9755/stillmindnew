"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toast = void 0;
var _toaster = require("./toaster.js");
const toast = (title, options) => {
  return (0, _toaster.getToastContext)().addToast({
    title,
    variant: 'info',
    ...options
  });
};
exports.toast = toast;
toast.success = (title, options = {}) => {
  return (0, _toaster.getToastContext)().addToast({
    ...options,
    title,
    variant: 'success'
  });
};
toast.wiggle = id => {
  return (0, _toaster.getToastContext)().wiggleToast(id);
};
toast.error = (title, options = {}) => {
  return (0, _toaster.getToastContext)().addToast({
    ...options,
    title,
    variant: 'error'
  });
};
toast.warning = (title, options = {}) => {
  return (0, _toaster.getToastContext)().addToast({
    ...options,
    title,
    variant: 'warning'
  });
};
toast.info = (title, options = {}) => {
  return (0, _toaster.getToastContext)().addToast({
    title,
    ...options,
    variant: 'info'
  });
};
toast.promise = (promise, options) => {
  return (0, _toaster.getToastContext)().addToast({
    ...options,
    title: options.loading,
    variant: 'info',
    promiseOptions: {
      ...options,
      promise
    }
  });
};
toast.custom = (jsx, options) => {
  return (0, _toaster.getToastContext)().addToast({
    title: '',
    variant: 'info',
    jsx,
    ...options
  });
};
toast.loading = (title, options = {}) => {
  return (0, _toaster.getToastContext)().addToast({
    title,
    variant: 'loading',
    ...options
  });
};
toast.dismiss = id => {
  return (0, _toaster.getToastContext)().dismissToast(id);
};
//# sourceMappingURL=toast-fns.js.map