import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { formatCurrency } from '../utils/format';

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieSlice[];
  size: number;
  title?: string;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function PieChart({ data, size, title }: PieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.55; // donut
  const gap = 1.5; // degree gap between slices

  let currentAngle = 0;
  const slices = data.map((d, i) => {
    const sliceAngle = (d.value / total) * 360;
    const startAngle = currentAngle + gap / 2;
    const endAngle = currentAngle + sliceAngle - gap / 2;
    currentAngle += sliceAngle;
    return { ...d, startAngle, endAngle, index: i, pct: d.value / total };
  });

  const activeSlice = activeIndex !== null ? slices[activeIndex] : null;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.row}>
        <View style={styles.chartWrap}>
          <Svg width={size} height={size}>
            {slices.map((s) => {
              if (s.endAngle - s.startAngle < 0.5) return null;
              const isActive = activeIndex === s.index;
              const r = isActive ? outerR + 3 : outerR;
              // Outer arc
              const outerStart = polarToCartesian(cx, cy, r, s.endAngle);
              const outerEnd = polarToCartesian(cx, cy, r, s.startAngle);
              const innerStart = polarToCartesian(cx, cy, innerR, s.endAngle);
              const innerEnd = polarToCartesian(cx, cy, innerR, s.startAngle);
              const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0;
              const path = [
                `M ${outerStart.x} ${outerStart.y}`,
                `A ${r} ${r} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
                `L ${innerEnd.x} ${innerEnd.y}`,
                `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
                'Z',
              ].join(' ');
              return (
                <Path
                  key={s.index}
                  d={path}
                  fill={s.color}
                  opacity={activeIndex !== null && !isActive ? 0.4 : 1}
                  onPress={() => setActiveIndex(activeIndex === s.index ? null : s.index)}
                />
              );
            })}
            {/* Center label */}
            {activeSlice && (
              <>
                <SvgCircle cx={cx} cy={cy} r={innerR - 6} fill={Colors.background} />
              </>
            )}
          </Svg>
          {activeSlice && (
            <View style={[styles.centerLabel, { width: innerR * 1.6, height: innerR * 1.6, top: cy - innerR * 0.8, left: cx - innerR * 0.8 }]} pointerEvents="none">
              <Text style={styles.centerPct}>{(activeSlice.pct * 100).toFixed(0)}%</Text>
              <Text style={styles.centerAmount} numberOfLines={1}>{formatCurrency(activeSlice.value)}</Text>
            </View>
          )}
        </View>
        <View style={styles.legend}>
          {slices.map((s) => (
            <TouchableOpacity
              key={s.index}
              style={[styles.legendItem, activeIndex === s.index && styles.legendItemActive]}
              onPress={() => setActiveIndex(activeIndex === s.index ? null : s.index)}
              activeOpacity={0.7}
            >
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <View style={styles.legendText}>
                <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
                <Text style={styles.legendValue}>{(s.pct * 100).toFixed(0)}%</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  chartWrap: {
    position: 'relative',
  },
  centerLabel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPct: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  centerAmount: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  legend: {
    flex: 1,
    gap: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  legendItemActive: {
    backgroundColor: Colors.tileBg,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  legendValue: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});
