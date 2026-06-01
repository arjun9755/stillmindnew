"use strict";

import { getToastContext } from "./toaster.js";
export const toast = (title, options) => {
  return getToastContext().addToast({
    title,
    variant: 'info',
    ...options
  });
};
toast.success = (title, options = {}) => {
  return getToastContext().addToast({
    ...options,
    title,
    variant: 'success'
  });
};
toast.wiggle = id => {
  return getToastContext().wiggleToast(id);
};
toast.error = (title, options = {}) => {
  return getToastContext().addToast({
    ...options,
    title,
    variant: 'error'
  });
};
toast.warning = (title, options = {}) => {
  return getToastContext().addToast({
    ...options,
    title,
    variant: 'warning'
  });
};
toast.info = (title, options = {}) => {
  return getToastContext().addToast({
    title,
    ...options,
    variant: 'info'
  });
};
toast.promise = (promise, options) => {
  return getToastContext().addToast({
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
  return getToastContext().addToast({
    title: '',
    variant: 'info',
    jsx,
    ...options
  });
};
toast.loading = (title, options = {}) => {
  return getToastContext().addToast({
    title,
    variant: 'loading',
    ...options
  });
};
toast.dismiss = id => {
  return getToastContext().dismissToast(id);
};
//# sourceMappingURL=toast-fns.js.map