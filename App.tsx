import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation';
import LoginScreen from './src/screens/LoginScreen';
import { setDemoMode } from './src/storage';
import { ThemeContext, ThemeMode, setThemeColors, getColors } from './src/theme';

const APP_PASSWORD = process.env.EXPO_PUBLIC_APP_PASSWORD || 'invest2024';
const DEMO_PASSWORD = 'demo';
const THEME_STORAGE_KEY = '@sofi_theme_mode';

// Context so any screen can check if we're in demo mode
export const DemoContext = createContext(false);
export const useDemoMode = () => useContext(DemoContext);

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(stored => {
      if (stored === 'dark' || stored === 'light') {
        setThemeMode(stored);
        setThemeColors(stored);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(prev => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      setThemeColors(next);
      AsyncStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const handleLogin = useCallback((enteredPassword: string) => {
    const demo = enteredPassword.toLowerCase() === DEMO_PASSWORD;
    setIsDemo(demo);
    setDemoMode(demo);
    setAuthenticated(true);
  }, []);

  const themeContextValue = {
    mode: themeMode,
    colors: getColors(themeMode),
    toggle: toggleTheme,
  };

  if (!authenticated) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <LoginScreen onLogin={handleLogin} password={APP_PASSWORD} demoPassword={DEMO_PASSWORD} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <DemoContext.Provider value={isDemo}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <AppNavigator />
      </DemoContext.Provider>
    </ThemeContext.Provider>
  );
}
