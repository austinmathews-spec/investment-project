import React, { useCallback, useId, useState } from 'react';
import { View, Text, StyleSheet, Platform, GestureResponderEvent } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Colors, FontSizes, Spacing } from '../theme';

interface DataSeries {
  label: string;
  color: string;
  data: number[]; // values per point
}

interface ComparisonChartProps {
  series: DataSeries[];
  labels: string[]; // x-axis labels (one per data point)
  width: number;
  height: number;
  formatValue?: (value: number) => string;
}

export default function ComparisonChart({
  series,
  labels,
  width,
  height,
  formatValue = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
}: ComparisonChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartId = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (series.length === 0 || labels.length < 2) return null;

  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute global min/max across all series
  const allValues = series.flatMap((s) => s.data);
  const min = Math.min(...allValues, 0) * 1.1;
  const max = Math.max(...allValues, 0) * 1.1;
  const range = max - min || 1;

  const getPoint = (value: number, i: number) => ({
    x: paddingLeft + (i / (labels.length - 1)) * chartWidth,
    y: paddingTop + chartHeight - ((value - min) / range) * chartHeight,
  });

  // Zero line
  const zeroY = paddingTop + chartHeight - ((0 - min) / range) * chartHeight;

  const gridLines = 5;
  const gridValues = Array.from({ length: gridLines }, (_, i) => {
    return min + ((max - min) / (gridLines - 1)) * i;
  });

  const maxLabels = 5;
  const labelInterval = Math.max(1, Math.floor(labels.length / maxLabels));

  const findNearestIndex = useCallback(
    (localX: number): number => {
      let nearest = 0;
      let minDist = Infinity;
      for (let i = 0; i < labels.length; i++) {
        const x = paddingLeft + (i / (labels.length - 1)) * chartWidth;
        const dist = Math.abs(x - localX);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      return nearest;
    },
    [labels.length, paddingLeft, chartWidth]
  );

  const handlePointer = useCallback(
    (localX: number) => {
      setActiveIndex(findNearestIndex(localX));
    },
    [findNearestIndex]
  );

  const handleTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      const touch = e.nativeEvent;
      if (touch.locationX !== undefined) {
        handlePointer(touch.locationX);
      }
    },
    [handlePointer]
  );

  const handleMouseMove = useCallback(
    (e: any) => {
      if (Platform.OS === 'web') {
        const offsetX = e.nativeEvent?.offsetX ?? e.nativeEvent?.layerX;
        if (offsetX !== undefined) {
          handlePointer(offsetX);
        }
      }
    },
    [handlePointer]
  );

  const handleLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const activeX =
    activeIndex !== null
      ? paddingLeft + (activeIndex / (labels.length - 1)) * chartWidth
      : null;

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Tooltip */}
      <View style={styles.tooltipContainer}>
        {activeIndex !== null && (
          <View style={styles.tooltipRow}>
            <Text style={styles.tooltipDate}>{labels[activeIndex]}</Text>
            {series.map((s) => (
              <Text key={s.label} style={[styles.tooltipValue, { color: s.color }]}>
                {s.label}: {formatValue(s.data[activeIndex])}
              </Text>
            ))}
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
          {/* Grid */}
          {gridValues.map((val, i) => {
            const y = paddingTop + chartHeight - ((val - min) / range) * chartHeight;
            return (
              <Line
                key={`grid-${chartId}-${i}`}
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

          {/* Zero baseline */}
          <Line
            x1={paddingLeft}
            y1={zeroY}
            x2={paddingLeft + chartWidth}
            y2={zeroY}
            stroke={Colors.textTertiary}
            strokeWidth="1"
            strokeOpacity={0.5}
          />

          {/* Series lines */}
          {series.map((s) => {
            const points = s.data
              .map((val, i) => {
                const pt = getPoint(val, i);
                return `${pt.x},${pt.y}`;
              })
              .join(' ');
            return (
              <Polyline
                key={s.label}
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Crosshair */}
          {activeX !== null && (
            <>
              <Line
                x1={activeX}
                y1={paddingTop}
                x2={activeX}
                y2={paddingTop + chartHeight}
                stroke={Colors.textTertiary}
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              {series.map((s) => {
                const pt = getPoint(s.data[activeIndex!], activeIndex!);
                return (
                  <Circle
                    key={`dot-${s.label}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={5}
                    fill={s.color}
                    stroke={Colors.background}
                    strokeWidth={2}
                  />
                );
              })}
            </>
          )}

          {/* X labels */}
          {labels.map((label, i) => {
            if (i % labelInterval !== 0 && i !== labels.length - 1) return null;
            const x = paddingLeft + (i / (labels.length - 1)) * chartWidth;
            return (
              <SvgText
                key={`label-${i}`}
                x={x}
                y={paddingTop + chartHeight + 18}
                fill={activeIndex === i ? Colors.textPrimary : Colors.textTertiary}
                fontSize="10"
                fontWeight={activeIndex === i ? '700' : '400'}
                textAnchor="middle"
              >
                {label}
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
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  tooltipContainer: {
    width: '100%',
    minHeight: 36,
    marginBottom: 2,
  },
  tooltipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    alignItems: 'center',
  },
  tooltipDate: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
  tooltipValue: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
});
