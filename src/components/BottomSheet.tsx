import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Colors, BorderRadius, Spacing, Motion } from '../theme';
import { prefersReducedMotion } from '../utils/motion';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightRatio?: number;
}

// Mobile-first bottom sheet: rounded top corners, drag handle, swipe-down or
// backdrop-tap to dismiss. Body scroll is locked while open (web).
export default function BottomSheet({
  visible,
  onClose,
  children,
  maxHeightRatio = 0.82,
}: BottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const dragY = useRef(0);

  const animateIn = useCallback(() => {
    const reduced = prefersReducedMotion();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: reduced ? 0 : Motion.panel,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: reduced ? 0 : Motion.panel,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdrop]);

  const animateOut = useCallback(
    (done: () => void) => {
      const reduced = prefersReducedMotion();
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: reduced ? 0 : Motion.panel,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: reduced ? 0 : Motion.panel,
          useNativeDriver: true,
        }),
      ]).start(() => done());
    },
    [translateY, backdrop, screenHeight]
  );

  useEffect(() => {
    if (visible) {
      translateY.setValue(screenHeight);
      animateIn();
    }
  }, [visible, animateIn, screenHeight, translateY]);

  // Lock body scroll on web while the sheet is open.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (visible) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [visible]);

  const requestClose = useCallback(() => {
    animateOut(onClose);
  }, [animateOut, onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => {
        dragY.current = Math.max(0, g.dy);
        translateY.setValue(dragY.current);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90 || g.vy > 0.6) {
          requestClose();
        } else {
          Animated.timing(translateY, {
            toValue: 0,
            duration: Motion.select,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: screenHeight * maxHeightRatio,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: Spacing.xl,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.textTertiary,
  },
});
