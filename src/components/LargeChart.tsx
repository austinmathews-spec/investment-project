import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Defs, LinearGradient as SvgLinearGradient, Stop, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { Colors, FontSizes, Spacing } from '../theme';
import { formatCurrency } from '../utils/format';

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

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="lgChartGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {showGrid &&
          gridValues.map((val, i) => {
            const y = paddingTop + chartHeight - ((val - min) / range) * chartHeight;
            return (
              <React.Fragment key={`grid-${i}`}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke={Colors.border}
                  strokeWidth="0.5"
                  strokeDasharray="4,4"
                />
                <SvgText
                  x={paddingLeft + chartWidth + 4}
                  y={y + 4}
                  fill={Colors.textTertiary}
                  fontSize="9"
                  textAnchor="start"
                >
                  {formatCurrency(val)}
                </SvgText>
              </React.Fragment>
            );
          })}

        <Polygon points={fillPoints} fill="url(#lgChartGrad)" />
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {showLabels &&
          data.map((d, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return null;
            const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
            return (
              <SvgText
                key={`label-${i}`}
                x={x}
                y={paddingTop + chartHeight + 18}
                fill={Colors.textTertiary}
                fontSize="10"
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            );
          })}
      </Svg>
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
});
