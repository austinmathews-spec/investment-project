import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { Motion } from '../theme';
import { prefersReducedMotion } from '../utils/motion';

interface AnimatedNumberProps {
  value: number;
  format: (v: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

// Counts from the previous value to the new one over ~250ms using rAF.
export default function AnimatedNumber({
  value,
  format,
  style,
  duration = Motion.count,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;
    if (prefersReducedMotion()) {
      setDisplay(to);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <Text style={style}>{format(display)}</Text>;
}
