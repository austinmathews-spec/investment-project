import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { formatCurrency } from '../utils/format';

interface BarItem {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarItem[];
  width: number;
  height: number;
  title?: string;
}

export default function BarChart({ data, width, height, title }: BarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 44;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barGap = Math.min(8, chartW / data.length * 0.15);
  const barWidth = Math.max(12, (chartW - barGap * (data.length + 1)) / data.length);

  // Grid lines
  const gridCount = 4;
  const gridStep = maxVal / gridCount;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {/* Tooltip */}
      {activeIndex !== null && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipLabel}>{data[activeIndex].label}</Text>
          <Text style={styles.tooltipValue}>{formatCurrency(data[activeIndex].value)}</Text>
        </View>
      )}
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {Array.from({ length: gridCount + 1 }).map((_, i) => {
          const y = paddingTop + chartH - (i * gridStep / maxVal) * chartH;
          return (
            <Line
              key={`grid-${i}`}
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke={Colors.border}
              strokeWidth={1}
            />
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * chartH;
          const x = paddingLeft + barGap + i * (barWidth + barGap);
          const y = paddingTop + chartH - barH;
          const isActive = activeIndex === i;
          const radius = Math.min(4, barWidth / 2);
          return (
            <React.Fragment key={i}>
              {/* Rounded top rect via clipPath workaround — use two rects */}
              <Rect
                x={x}
                y={y + radius}
                width={barWidth}
                height={Math.max(0, barH - radius)}
                fill={d.color}
                opacity={activeIndex !== null && !isActive ? 0.4 : 1}
                onPress={() => setActiveIndex(isActive ? null : i)}
              />
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.min(barH, radius * 2)}
                fill={d.color}
                rx={radius}
                ry={radius}
                opacity={activeIndex !== null && !isActive ? 0.4 : 1}
                onPress={() => setActiveIndex(isActive ? null : i)}
              />
              {/* X-axis label */}
              <SvgText
                x={x + barWidth / 2}
                y={paddingTop + chartH + 14}
                fill={Colors.textTertiary}
                fontSize={10}
                fontWeight="500"
                textAnchor="middle"
              >
                {truncateLabel(d.label, 8)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function truncateLabel(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const styles = StyleSheet.create({
  container: {},
  title: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  tooltip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  tooltipLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  tooltipValue: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '700',
  },
});
