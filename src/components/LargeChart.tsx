import React, { useCallback, useId, useState } from 'react';
import { View, Text, StyleSheet, Platform, GestureResponderEvent } from 'react-native';
import Svg, { Polyline, Defs, LinearGradient as SvgLinearGradient, Stop, Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Colors, FontSizes, Spacing } from '../theme';
import { formatCurrencyDecimal } from '../utils/format';

interface DataPoint {
  label: string;
  value: number;
}

interface LargeChartProps {
  data: DataPoint[];
  width: number;
  height: number;
  color?: string;
  title?: string;
  showLabels?: boolean;
  showGrid?: boolean;
}

export default function LargeChart({
  data,
  width,
  height,
  color = Colors.accent,
  title,
  showLabels = true,
  showGrid = true,
}: LargeChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (data.length < 2) return null;

  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = showLabels ? 30 : 10;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values) * 0.95;
  const max = Math.max(...values) * 1.02;
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - min) / range) * chartHeight;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  const fillPoints = [
    `${paddingLeft},${paddingTop + chartHeight}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${paddingLeft + chartWidth},${paddingTop + chartHeight}`,
  ].join(' ');

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines }, (_, i) => {
    return min + ((max - min) / (gridLines - 1)) * i;
  });

  const maxLabels = 5;
  const labelInterval = Math.max(1, Math.floor(data.length / maxLabels));

  const findNearestIndex = useCallback((localX: number): number => {
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - localX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    return nearest;
  }, [points]);

  const handlePointer = useCallback((localX: number) => {
    const idx = findNearestIndex(localX);
    setActiveIndex(idx);
  }, [findNearestIndex]);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const touch = e.nativeEvent;
    // Use locationX if available (relative to element), otherwise fall back
    if (touch.locationX !== undefined) {
      handlePointer(touch.locationX);
    }
  }, [handlePointer]);

  const handleMouseMove = useCallback((e: any) => {
    if (Platform.OS === 'web') {
      // On web, nativeEvent is the DOM MouseEvent with offsetX
      const offsetX = e.nativeEvent?.offsetX ?? e.nativeEvent?.layerX;
      if (offsetX !== undefined) {
        handlePointer(offsetX);
      }
    }
  }, [handlePointer]);

  const handleLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeData = activeIndex !== null ? data[activeIndex] : null;

  // Tooltip positioning
  let tooltipLeft = 0;
  if (activePoint) {
    tooltipLeft = activePoint.x - 60;
    if (tooltipLeft < 0) tooltipLeft = 0;
    if (tooltipLeft + 120 > width) tooltipLeft = width - 120;
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Tooltip above chart */}
      <View style={styles.tooltipContainer}>
        {activeData && (
          <View style={[styles.tooltip, { left: tooltipLeft }]}>
            <Text style={styles.tooltipValue}>{formatCurrencyDecimal(activeData.value)}</Text>
            <Text style={styles.tooltipLabel}>{activeData.label}</Text>
          </View>
        )}
      </View>

      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouchMove}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleLeave}
        // @ts-ignore — web-only mouse events
        onMouseMove={Platform.OS === 'web' ? handleMouseMove : undefined}
        onMouseLeave={Platform.OS === 'web' ? handleLeave : undefined}
        style={{ cursor: 'crosshair' } as any}
      >
        <Svg width={width} height={height}>
          <Defs>
            <SvgLinearGradient id={`lgChartGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.25" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {showGrid &&
            gridValues.map((val, i) => {
              const y = paddingTop + chartHeight - ((val - min) / range) * chartHeight;
              return (
                <Line
                  key={`grid-${i}`}
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke={Colors.border}
                  strokeWidth="0.5"
                  strokeDasharray="4,4"
                />
              );
            })}

          <Polygon points={fillPoints} fill={`url(#lgChartGrad-${gradientId})`} />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Crosshair line + dot */}
          {activePoint && (
            <>
              <Line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={paddingTop + chartHeight}
                stroke={Colors.textTertiary}
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={5}
                fill={color}
                stroke={Colors.background}
                strokeWidth={2}
              />
            </>
          )}

          {showLabels &&
            data.map((d, i) => {
              if (i % labelInterval !== 0 && i !== data.length - 1) return null;
              const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
              const isActive = activeIndex === i;
              return (
                <SvgText
                  key={`label-${i}`}
                  x={x}
                  y={paddingTop + chartHeight + 18}
                  fill={isActive ? Colors.textPrimary : Colors.textTertiary}
                  fontSize="10"
                  fontWeight={isActive ? '700' : '400'}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              );
            })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  title: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  tooltipContainer: {
    width: '100%',
    height: 36,
    position: 'relative',
    marginBottom: 2,
  },
  tooltip: {
    position: 'absolute',
    width: 120,
    alignItems: 'center',
  },
  tooltipValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  tooltipLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
});
