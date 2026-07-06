import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { AppData } from '../types';
import { loadAppData } from '../storage';
import { formatCurrency, formatCurrencyDecimal, formatDate } from '../utils/format';
import LargeChart from '../components/LargeChart';
import ComparisonChart from '../components/ComparisonChart';
import FilterChips from '../components/FilterChips';
import ScreenSkeleton from '../components/ScreenSkeleton';

export default function TrendsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [data, setData] = useState<AppData | null>(null);
  const [dateRange, setDateRange] = useState('All Time');

  useFocusEffect(
    useCallback(() => {
      loadAppData().then(setData);
    }, [])
  );

  if (!data) return <ScreenSkeleton />;

  const allSnapshots = data.snapshots;

  const dateRangeOptions = ['All Time', '6 Months', '1 Year', '2 Years'];
  const now = new Date();
  const filterDate = (range: string): Date => {
    const d = new Date(now);
    if (range === '6 Months') d.setMonth(d.getMonth() - 6);
    else if (range === '1 Year') d.setFullYear(d.getFullYear() - 1);
    else if (range === '2 Years') d.setFullYear(d.getFullYear() - 2);
    else return new Date(0);
    return d;
  };
  const cutoff = filterDate(dateRange);
  const snapshots = allSnapshots.filter(s => new Date(s.date) >= cutoff);

  const chartData = snapshots.map((s) => ({
    label: formatDate(s.date),
    value: s.netWorth,
  }));

  const spyChartData = snapshots.map((s) => ({
    value: s.spyPrice ?? 0,
  }));

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const totalGrowth = latest && first ? latest.netWorth - first.netWorth : 0;
  const totalGrowthPct = first && first.netWorth > 0 ? totalGrowth / first.netWorth : 0;
  const isPositive = totalGrowth >= 0;

  const changes = snapshots.slice(1).map((s, i) => {
    const prev = snapshots[i];
    const change = s.netWorth - prev.netWorth;
    const changePct = prev.netWorth > 0 ? change / prev.netWorth : 0;
    return { snapshot: s, prev, change, changePct };
  });

  const contentMaxWidth = 960;
  const chartWidthClamped = Math.min(Math.min(screenWidth, contentMaxWidth) - 40, 800);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
      <View style={[styles.contentInner, { maxWidth: contentMaxWidth, width: '100%' }]}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Net Worth Trends</Text>
        {latest && (
          <Text style={styles.heroAmount}>{formatCurrencyDecimal(latest.netWorth)}</Text>
        )}
        {first && latest && (
          <View style={styles.changeRow}>
            <View style={[styles.changeBadge, { backgroundColor: isPositive ? Colors.accentDim : 'rgba(255,80,0,0.08)' }]}>
              <Feather
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={14}
                color={isPositive ? Colors.positive : Colors.negative}
              />
              <Text style={[styles.changeText, { color: isPositive ? Colors.positive : Colors.negative }]}>
                {isPositive ? '+' : ''}{formatCurrency(totalGrowth)} ({isPositive ? '+' : ''}{(totalGrowthPct * 100).toFixed(1)}%)
              </Text>
            </View>
            <Text style={styles.changePeriod}>all time</Text>
          </View>
        )}
      </View>

      {/* Date Range Filter */}
      <FilterChips options={dateRangeOptions} selected={dateRange} onSelect={setDateRange} />

      {/* Chart */}
      {chartData.length >= 2 && (
        <View style={styles.chartContainer}>
          <LargeChart
            data={chartData}
            width={chartWidthClamped}
            height={220}
            color={Colors.accent}
            spyData={spyChartData}
          />
        </View>
      )}

      {/* vs. Market (SPY) */}
      {(() => {
        const spySnapshots = snapshots.filter(s => s.spyPrice != null && s.spyPrice > 0);
        if (spySnapshots.length < 2) return null;
        const baseNW = spySnapshots[0].netWorth;
        const baseSPY = spySnapshots[0].spyPrice!;
        const nwGrowth = spySnapshots.map(s => ((s.netWorth - baseNW) / baseNW) * 100);
        const spyGrowth = spySnapshots.map(s => ((s.spyPrice! - baseSPY) / baseSPY) * 100);
        const spyLabels = spySnapshots.map(s => formatDate(s.date));
        const latestNW = nwGrowth[nwGrowth.length - 1];
        const latestSPY = spyGrowth[spyGrowth.length - 1];
        const outperformance = latestNW - latestSPY;
        const beating = outperformance >= 0;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>vs. Market (S&P 500)</Text>
            <View style={styles.marketSummary}>
              <View style={[styles.marketBadge, { backgroundColor: beating ? Colors.accentDim : 'rgba(255,80,0,0.08)' }]}>
                <Feather name={beating ? 'trending-up' : 'trending-down'} size={14} color={beating ? Colors.positive : Colors.negative} />
                <Text style={[styles.marketBadgeText, { color: beating ? Colors.positive : Colors.negative }]}>
                  {beating ? 'Outperforming' : 'Underperforming'} by {Math.abs(outperformance).toFixed(1)}%
                </Text>
              </View>
              <Text style={styles.marketHint}>
                Your wealth {latestNW >= 0 ? '+' : ''}{latestNW.toFixed(1)}% vs SPY {latestSPY >= 0 ? '+' : ''}{latestSPY.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.chartContainer}>
              <ComparisonChart
                series={[
                  { label: 'Your Wealth', color: Colors.accent, data: nwGrowth },
                  { label: 'S&P 500', color: Colors.textTertiary, data: spyGrowth },
                ]}
                labels={spyLabels}
                width={chartWidthClamped}
                height={220}
              />
            </View>
          </View>
        );
      })()}

      {/* Period Changes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Period Changes</Text>
        {changes.reverse().map((c, i) => {
          const cPositive = c.change >= 0;
          return (
            <View key={i} style={styles.changeTile}>
              <View>
                <Text style={styles.tileDates}>
                  {formatDate(c.prev.date)} → {formatDate(c.snapshot.date)}
                </Text>
                <Text style={styles.tileNetWorth}>
                  {formatCurrencyDecimal(c.snapshot.netWorth)}
                </Text>
              </View>
              <View style={styles.tileRight}>
                <Text style={[styles.tileChange, { color: cPositive ? Colors.positive : Colors.negative }]}>
                  {cPositive ? '+' : ''}{formatCurrency(c.change)}
                </Text>
                <Text style={[styles.tilePct, { color: cPositive ? Colors.positive : Colors.negative }]}>
                  {cPositive ? '+' : ''}{(c.changePct * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          );
        })}
        {changes.length === 0 && (
          <View style={styles.emptyTile}>
            <Feather name="bar-chart-2" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Save at least 2 snapshots to see period changes</Text>
          </View>
        )}
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xxl,
  },
  contentInner: {
    alignSelf: 'center',
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  heroLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  heroAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.hero,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  changeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  changePeriod: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  chartContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  changeTile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tileDates: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  tileNetWorth: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginTop: 2,
  },
  tileRight: {
    alignItems: 'flex-end',
  },
  tileChange: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  tilePct: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  emptyTile: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
  marketSummary: {
    marginBottom: Spacing.md,
  },
  marketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 6,
  },
  marketBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  marketHint: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
});
