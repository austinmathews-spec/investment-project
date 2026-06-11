import React, { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Defs, LinearGradient as SvgLinearGradient, Stop, Polygon } from 'react-native-svg';
import { Colors } from '../theme';

interface MiniChartProps {
  data: number[];
  width: number;
  height: number;
  color?: string;
  showFill?: boolean;
}

export default function MiniChart({
  data,
  width,
  height,
  color = Colors.accent,
  showFill = true,
}: MiniChartProps) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (data.length < 2) return null;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((val - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const fillPoints = [
    `${padding},${padding + chartHeight}`,
    ...points,
    `${padding + chartWidth},${padding + chartHeight}`,
  ].join(' ');

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id={`chartGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        {showFill && (
          <Polygon points={fillPoints} fill={`url(#chartGrad-${gradientId})`} />
        )}
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
