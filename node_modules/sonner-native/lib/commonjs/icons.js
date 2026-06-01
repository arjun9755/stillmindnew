"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.X = exports.TriangleAlert = exports.Info = exports.CircleX = exports.CircleCheck = void 0;
var _reactNativeSvg = _interopRequireWildcard(require("react-native-svg"));
var _jsxRuntime = require("react/jsx-runtime");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
const CircleCheck = ({
  size,
  ...props
}) => /*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNativeSvg.default, {
  width: size || 24,
  height: size || 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  ...props,
  children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Circle, {
    cx: 12,
    cy: 12,
    r: 10
  }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Path, {
    d: "m9 12 2 2 4-4"
  })]
});
exports.CircleCheck = CircleCheck;
const CircleX = ({
  size,
  ...props
}) => /*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNativeSvg.default, {
  width: size || 24,
  height: size || 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  ...props,
  children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Circle, {
    cx: 12,
    cy: 12,
    r: 10
  }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Path, {
    d: "m15 9-6 6M9 9l6 6"
  })]
});
exports.CircleX = CircleX;
const Info = ({
  size,
  ...props
}) => /*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNativeSvg.default, {
  width: size || 24,
  height: size || 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  ...props,
  children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Circle, {
    cx: 12,
    cy: 12,
    r: 10
  }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Path, {
    d: "M12 16v-4M12 8h.01"
  })]
});
exports.Info = Info;
const TriangleAlert = ({
  size,
  ...props
}) => /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.default, {
  width: size || 24,
  height: size || 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  ...props,
  children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Path, {
    d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"
  })
});
exports.TriangleAlert = TriangleAlert;
const X = ({
  size,
  ...props
}) => /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.default, {
  width: size || 24,
  height: size || 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  ...props,
  children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNativeSvg.Path, {
    d: "M18 6 6 18M6 6l12 12"
  })
});
exports.X = X;
//# sourceMappingURL=icons.js.map