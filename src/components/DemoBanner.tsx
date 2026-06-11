import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../theme';

// Persistent strip shown above the app whenever demo mode is active.
export default function DemoBanner() {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Feather name="play-circle" size={14} color={Colors.black} />
      <Text style={styles.text}>DEMO MODE — viewing sample data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  text: {
    fontSize: FontSizes.xs,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.black,
  },
});
