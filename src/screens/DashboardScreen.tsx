import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { AppData } from '../types';
import { loadAppData } from '../storage';
import { formatCurrency, formatCurrencyDecimal, formatDate, accountTypeLabel } from '../utils/format';
import Card from '../components/Card';
import MiniChart from '../components/MiniChart';
import LargeChart from '../components/LargeChart';
import ProgressBar from '../components/ProgressBar';

const { width: screenWidth } = Dimensions.get('window');

export default function DashboardScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const appData = await loadAppData();
    setData(appData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!data) return null;

  const totalBalance = data.accounts.reduce((sum, a) => sum + a.balance, 0);
  const snapshotValues = data.snapshots.map((s) => s.netWorth);
  const latestSnapshot = data.snapshots[data.snapshots.length - 1];
  const prevSnapshot = data.snapshots.length > 1 ? data.snapshots[data.snapshots.length - 2] : null;
  const netChange = prevSnapshot ? totalBalance - prevSnapshot.netWorth : 0;
  const netChangePercent = prevSnapshot && prevSnapshot.netWorth > 0 ? netChange / prevSnapshot.netWorth : 0;
  const isPositive = netChange >= 0;

  const chartData = data.snapshots.map((s) => ({
    label: formatDate(s.date),
    value: s.netWorth,
  }));

  // Group accounts by type
  const accountsByType = data.accounts.reduce<Record<string, number>>((acc, a) => {
    const label = accountTypeLabel(a.type);
    acc[label] = (acc[label] || 0) + a.balance;
    return acc;
  }, {});

  const sortedTypes = Object.entries(accountsByType).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Net Worth Hero */}
      <View style={styles.heroSection}>
        <Text style={styles.heroLabel}>Net Worth</Text>
        <Text style={styles.heroAmount}>{formatCurrencyDecimal(totalBalance)}</Text>
        <View style={styles.changeRow}>
          <Text style={[styles.changeText, { color: isPositive ? Colors.positive : Colors.negative }]}>
            {isPositive ? '+' : ''}{formatCurrency(netChange)}
          </Text>
          <Text style={[styles.changePercent, { color: isPositive ? Colors.positive : Colors.negative }]}>
            {' '}({isPositive ? '+' : ''}{(netChangePercent * 100).toFixed(1)}%)
          </Text>
          {prevSnapshot && (
            <Text style={styles.changePeriod}> since {formatDate(prevSnapshot.date)}</Text>
          )}
        </View>
      </View>

      {/* Net Worth Chart */}
      {chartData.length >= 2 && (
        <Card>
          <LargeChart
            data={chartData}
            width={screenWidth - 80}
            height={180}
            color={Colors.accent}
            title="NET WORTH OVER TIME"
          />
        </Card>
      )}

      {/* Where Your Money Is */}
      <Card>
        <Text style={styles.sectionTitle}>Where Your Money Is</Text>
        {sortedTypes.map(([label, balance], i) => (
          <View key={label} style={styles.allocationRow}>
            <View style={styles.allocationLeft}>
              <View style={[styles.dot, { backgroundColor: Colors.goalColors[i % Colors.goalColors.length] }]} />
              <Text style={styles.allocationLabel}>{label}</Text>
            </View>
            <View style={styles.allocationRight}>
              <Text style={styles.allocationAmount}>{formatCurrency(balance)}</Text>
              <Text style={styles.allocationPercent}>
                {totalBalance > 0 ? ((balance / totalBalance) * 100).toFixed(1) : '0'}%
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.allocationRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatCurrencyDecimal(totalBalance)}</Text>
        </View>
      </Card>

      {/* Goals Quick View */}
      {data.goals.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Goals</Text>
          {data.goals.map((goal) => {
            const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
            return (
              <View key={goal.id} style={styles.goalRow}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalAmount}>
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                  </Text>
                </View>
                <ProgressBar progress={progress} color={goal.color} />
              </View>
            );
          })}
        </Card>
      )}

      {/* Accounts List */}
      <Card>
        <Text style={styles.sectionTitle}>Accounts</Text>
        {data.accounts.map((account) => (
          <View key={account.id} style={styles.accountRow}>
            <View>
              <Text style={styles.accountName}>{account.name}</Text>
              <Text style={styles.accountType}>{accountTypeLabel(account.type)} - {account.institution}</Text>
            </View>
            <Text style={styles.accountBalance}>{formatCurrencyDecimal(account.balance)}</Text>
          </View>
        ))}
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  heroLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  heroAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.hero,
    fontWeight: '700',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  changeText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  changePercent: {
    fontSize: FontSizes.sm,
  },
  changePeriod: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  allocationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  allocationLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
  allocationRight: {
    alignItems: 'flex-end',
  },
  allocationAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  allocationPercent: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  totalLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  totalAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  goalRow: {
    marginBottom: Spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  goalName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  goalAmount: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  accountName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  accountType: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  accountBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
