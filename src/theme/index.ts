import React, { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

const LightColors = {
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',
  cardBackgroundLight: '#F7F8FA',
  accent: '#00C805',
  accentLight: '#00E009',
  accentDim: 'rgba(0, 200, 5, 0.08)',
  positive: '#00C805',
  negative: '#FF5000',
  warning: '#FFB800',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#1A1A1A',
  textSecondary: '#6F7177',
  textTertiary: '#9DA0A6',
  border: '#F0F0F0',
  inputBackground: '#F7F8FA',
  tabBarBackground: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',
  chartLine: '#00C805',
  chartFill: 'rgba(0, 200, 5, 0.06)',
  goalColors: ['#00C805', '#6846EB', '#FFB800', '#FF5000', '#00AAFF', '#E91E63'],
  tileBg: '#F7F8FA',
};

const DarkColors = {
  background: '#0D0D0F',
  cardBackground: '#1A1A1F',
  cardBackgroundLight: '#1A1A1F',
  accent: '#00E009',
  accentLight: '#00FF10',
  accentDim: 'rgba(0, 224, 9, 0.12)',
  positive: '#00E009',
  negative: '#FF6B3D',
  warning: '#FFD000',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#F5F5F7',
  textSecondary: '#A1A1A6',
  textTertiary: '#6E6E73',
  border: '#2C2C2E',
  inputBackground: '#1C1C1E',
  tabBarBackground: '#0D0D0F',
  overlay: 'rgba(0, 0, 0, 0.7)',
  chartLine: '#00E009',
  chartFill: 'rgba(0, 224, 9, 0.08)',
  goalColors: ['#00E009', '#7C6AFF', '#FFD000', '#FF6B3D', '#00BBFF', '#FF4081'],
  tileBg: '#1A1A1F',
};

// Default export for backward compat — starts as light
export let Colors = { ...LightColors };

export function getColors(mode: ThemeMode) {
  return mode === 'dark' ? DarkColors : LightColors;
}

export function setThemeColors(mode: ThemeMode) {
  const newColors = getColors(mode);
  Object.assign(Colors, newColors);
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 48,
};

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 32,
  hero: 40,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

// Theme context
export interface ThemeContextType {
  mode: ThemeMode;
  colors: typeof LightColors;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  colors: LightColors,
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);
