import React, { useState, useCallback, createContext, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation';
import LoginScreen from './src/screens/LoginScreen';
import { setDemoMode } from './src/storage';

const APP_PASSWORD = process.env.EXPO_PUBLIC_APP_PASSWORD || 'invest2024';
const DEMO_PASSWORD = 'demo';

// Context so any screen can check if we're in demo mode
export const DemoContext = createContext(false);
export const useDemoMode = () => useContext(DemoContext);

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const handleLogin = useCallback((enteredPassword: string) => {
    const demo = enteredPassword.toLowerCase() === DEMO_PASSWORD;
    setIsDemo(demo);
    setDemoMode(demo);
    setAuthenticated(true);
  }, []);

  if (!authenticated) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={handleLogin} password={APP_PASSWORD} demoPassword={DEMO_PASSWORD} />
      </>
    );
  }

  return (
    <DemoContext.Provider value={isDemo}>
      <StatusBar style="dark" />
      <AppNavigator />
    </DemoContext.Provider>
  );
}
