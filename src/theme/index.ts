// Robinhood-inspired dark theme — single source of truth for design tokens.
export const Colors = {
  background: '#0d0d0d',
  cardBackground: '#141414',
  cardBackgroundLight: '#1a1a1a',
  accent: '#00C805',
  accentLight: '#00E009',
  accentDim: 'rgba(0, 200, 5, 0.12)',
  positive: '#00C805',
  negative: '#FF5000',
  negativeDim: 'rgba(255, 80, 0, 0.12)',
  warning: '#FFB800',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#FFFFFF',
  textSecondary: '#9DA0A6',
  textTertiary: '#6F7177',
  border: '#222426',
  inputBackground: '#1a1a1a',
  tabBarBackground: '#0d0d0d',
  overlay: 'rgba(0, 0, 0, 0.6)',
  chartLine: '#00C805',
  chartFill: 'rgba(0, 200, 5, 0.06)',
  goalColors: ['#00C805', '#6846EB', '#FFB800', '#FF5000', '#00AAFF', '#E91E63'],
  accountTypeColors: {
    '401k': '#6846EB',
    roth_ira: '#00AAFF',
    traditional_ira: '#3D7FFF',
    savings: '#00C805',
    checking: '#00D4AA',
    crypto: '#FFB800',
    brokerage: '#FF5000',
    hsa: '#E91E63',
    '529': '#9C27B0',
    other: '#9DA0A6',
  } as Record<string, string>,
  tileBg: '#141414',
  skeleton: '#1a1a1a',
  skeletonHighlight: '#242628',
};

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

// Motion durations (ms) — Robinhood-like: brief, subtle, ease-out.
export const Motion = {
  count: 250,
  colorFade: 250,
  select: 180,
  panel: 220,
};

// Minimum touch target size for interactive elements.
export const TouchTarget = 44;
