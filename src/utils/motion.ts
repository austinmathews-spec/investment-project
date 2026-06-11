import { Platform } from 'react-native';

// Honors the user's reduced-motion preference (web). Native falls back to false.
export function prefersReducedMotion(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}
