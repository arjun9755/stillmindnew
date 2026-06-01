"use strict";

import React from 'react';
import { AppState } from 'react-native';
export const useAppStateListener = ({
  onBackground,
  onForeground
}) => {
  const appState = React.useRef(AppState.currentState);
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
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
//# sourceMappingURL=use-app-state.js.map