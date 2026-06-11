import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation';
import LoginScreen from './src/screens/LoginScreen';
import { setDemoMode } from './src/storage';

const APP_PASSWORD = process.env.EXPO_PUBLIC_APP_PASSWORD || 'invest2024';
const DEMO_PASSWORD = 'demo';

// Context so any screen can check if we're in demo mode
export const DemoContext = createContext(false);
export const useDemoMode = () => useContext(DemoContext);

// Global web CSS: dynamic-viewport height, safe-area insets, no overscroll
// bounce/flash, dark background behind everything.
const WEB_GLOBAL_CSS = `
  html, body, #root {
    height: 100dvh;
    background-color: #0d0d0d;
    overscroll-behavior: none;
    -webkit-font-smoothing: antialiased;
  }
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
`;

function useWebGlobalStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = WEB_GLOBAL_CSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  useWebGlobalStyles();

  const handleLogin = useCallback((enteredPassword: string) => {
    const demo = enteredPassword.toLowerCase() === DEMO_PASSWORD;
    setIsDemo(demo);
    setDemoMode(demo);
    setAuthenticated(true);
  }, []);

  if (!authenticated) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLogin={handleLogin} password={APP_PASSWORD} demoPassword={DEMO_PASSWORD} />
      </>
    );
  }

  return (
    <DemoContext.Provider value={isDemo}>
      <StatusBar style="light" />
      <AppNavigator />
    </DemoContext.Provider>
  );
}
