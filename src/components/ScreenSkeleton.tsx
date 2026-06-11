import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius } from '../theme';
import Skeleton from './Skeleton';

export default function ScreenSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Skeleton width={120} height={16} />
        <Skeleton width={220} height={36} style={{ marginTop: Spacing.sm }} />
        <Skeleton width="100%" height={180} borderRadius={BorderRadius.md} style={{ marginTop: Spacing.xl }} />
        <Skeleton width="100%" height={72} borderRadius={BorderRadius.md} style={{ marginTop: Spacing.lg }} />
        <Skeleton width="100%" height={72} borderRadius={BorderRadius.md} style={{ marginTop: Spacing.sm }} />
        <Skeleton width="100%" height={72} borderRadius={BorderRadius.md} style={{ marginTop: Spacing.sm }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
});
