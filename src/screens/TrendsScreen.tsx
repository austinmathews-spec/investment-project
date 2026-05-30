import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, FontSizes, Spacing } from '../theme';
import { AppData } from '../types';
import { loadAppData } from '../storage';
import { formatCurrency, formatCurrencyDecimal, formatDate } from '../utils/format';
import Card from '../components/Card';
import LargeChart from '../components/LargeChart';

const { width: screenWidth } = Dimensions.get('window');

export default function TrendsScreen() {
  const [data, setData] = useState<AppData | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAppData().then(setData);
    }, [])
  );

  if (!data) return null;

  const snapshots = data.snapshots;
  const chartData = snapshots.map((s) => ({
    label: formatDate(s.date),
    value: s.netWorth,
  }));

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const totalGrowth = latest && first ? latest.netWorth - first.netWorth : 0;
  const totalGrowthPct = first && first.netWorth > 0 ? totalGrowth / first.netWorth : 0;

  // Period-over-period changes
  const changes = snapshots.slice(1).map((s, i) => {
    const prev = snapshots[i];
    const change = s.netWorth - prev.netWorth;
    const changePct = prev.netWorth > 0 ? change / prev.netWorth : 0;
    return { snapshot: s, prev, change, changePct };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Net Worth Trends</Text>
        <Text style={styles.headerSubtext}>Track changes every 2-3 months</Text>
      </View>

      {/* Overall Growth */}
      <Card>
        <Text style={styles.sectionTitle}>ALL-TIME GROWTH</Text>
        <View style={styles.growthRow}>
          <View>
            <Text style={styles.growthLabel}>Total Change</Text>
            <Text
              style={[
                styles.growthValue,
                { color: totalGrowth >= 0 ? Colors.positive : Colors.negative },
              ]}
            >
              {totalGrowth >= 0 ? '+' : ''}
              {formatCurrency(totalGrowth)}
            </Text>
          </View>
          <View style={styles.growthRight}>
            <Text style={styles.growthLabel}>Return</Text>
            <Text
              style={[
                styles.growthValue,
                { color: totalGrowthPct >= 0 ? Colors.positive : Colors.negative },
              ]}
            >
              {totalGrowthPct >= 0 ? '+' : ''}
              {(totalGrowthPct * 100).toFixed(1)}%
            </Text>
          </View>
        </View>
        {first && latest && (
          <Text style={styles.periodText}>
            {formatDate(first.date)} — {formatDate(latest.date)}
          </Text>
        )}
      </Card>

      {/* Chart */}
      {chartData.length >= 2 && (
        <Card>
          <LargeChart
            data={chartData}
            width={screenWidth - 80}
            height={220}
            color={Colors.accent}
            title="NET WORTH HISTORY"
          />
        </Card>
      )}

      {/* Period Changes */}
      <Card>
        <Text style={styles.sectionTitle}>PERIOD CHANGES</Text>
        {changes.reverse().map((c, i) => (
          <View key={i} style={styles.changeRow}>
            <View>
              <Text style={styles.changePeriod}>
                {formatDate(c.prev.date)} → {formatDate(c.snapshot.date)}
              </Text>
              <Text style={styles.changeNetWorth}>
                {formatCurrencyDecimal(c.snapshot.netWorth)}
              </Text>
            </View>
            <View style={styles.changeRight}>
              <Text
                style={[
                  styles.changeAmount,
                  { color: c.change >= 0 ? Colors.positive : Colors.negative },
                ]}
              >
                {c.change >= 0 ? '+' : ''}
                {formatCurrency(c.change)}
              </Text>
              <Text
                style={[
                  styles.changePercent,
                  { color: c.changePct >= 0 ? Colors.positive : Colors.negative },
                ]}
              >
                {c.changePct >= 0 ? '+' : ''}
                {(c.changePct * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
        {changes.length === 0 && (
          <Text style={styles.emptyText}>Save at least 2 snapshots to see period changes</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    paddingVertical: Spacing.lg,
  },
  headerLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  headerSubtext: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  growthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  growthRight: {
    alignItems: 'flex-end',
  },
  growthLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  growthValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  periodText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.md,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  changePeriod: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  changeNetWorth: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '500',
    marginTop: 2,
  },
  changeRight: {
    alignItems: 'flex-end',
  },
  changeAmount: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  changePercent: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
