import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation';
import LoginScreen from './src/screens/LoginScreen';

const APP_PASSWORD = process.env.EXPO_PUBLIC_APP_PASSWORD || 'invest2024';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);

  const handleLogin = useCallback(() => {
    setAuthenticated(true);
  }, []);

  if (!authenticated) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={handleLogin} password={APP_PASSWORD} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
