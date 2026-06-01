"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useAppStateListener = void 0;
var _react = _interopRequireDefault(require("react"));
var _reactNative = require("react-native");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const useAppStateListener = ({
  onBackground,
  onForeground
}) => {
  const appState = _react.default.useRef(_reactNative.AppState.currentState);
  _react.default.useEffect(() => {
    const subscription = _reactNative.AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        onForeground();
      } else {
        onBackground();
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, [onBackground, onForeground]);
};
exports.useAppStateListener = useAppStateListener;
//# sourceMappingURL=use-app-state.js.map