import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, Spacing, useTheme } from '../theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.tileBg }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
