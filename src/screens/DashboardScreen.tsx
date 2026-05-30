import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { AppData } from '../types';
import { loadAppData, syncWithAirtable, loadAirtableConfig } from '../storage';
import { formatCurrency, formatCurrencyDecimal, formatDate, accountTypeLabel } from '../utils/format';
import { calculateFIRENumber } from '../utils/forecast';
import LargeChart from '../components/LargeChart';
import ProgressBar from '../components/ProgressBar';
import FilterChips from '../components/FilterChips';

export default function DashboardScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;
  const [data, setData] = useState<AppData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [accountFilter, setAccountFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('Excl. Non-Cash');
  const [expenseFilter, setExpenseFilter] = useState('All');
  const navigation = useNavigation<any>();
  const contentMaxWidth = 960;
  const contentWidth = Math.min(screenWidth, contentMaxWidth);
  const chartWidth = Math.min(contentWidth - 40, 800);

  const loadData = useCallback(async () => {
    const config = await loadAirtableConfig();
    let appData: AppData;
    if (config && config.pat && config.baseId) {
      try {
        appData = await syncWithAirtable();
      } catch {
        appData = await loadAppData();
      }
    } else {
      appData = await loadAppData();
    }
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
  const prevSnapshot = data.snapshots.length > 1 ? data.snapshots[data.snapshots.length - 2] : null;
  const netChange = prevSnapshot ? totalBalance - prevSnapshot.netWorth : 0;
  const netChangePercent = prevSnapshot && prevSnapshot.netWorth > 0 ? netChange / prevSnapshot.netWorth : 0;
  const isPositive = netChange >= 0;

  const chartData = data.snapshots.map((s) => ({
    label: formatDate(s.date),
    value: s.netWorth,
  }));

  // Group accounts by type for allocation
  const accountsByType = data.accounts.reduce<Record<string, number>>((acc, a) => {
    const label = accountTypeLabel(a.type);
    acc[label] = (acc[label] || 0) + a.balance;
    return acc;
  }, {});
  const sortedTypes = Object.entries(accountsByType).sort((a, b) => b[1] - a[1]);

  // Financial insights
  const totalMonthlyExpenses = data.expenses.reduce((sum, e) => sum + e.effectiveAmount, 0);
  const annualExpenses = totalMonthlyExpenses * 12;
  const fireNumber = calculateFIRENumber(annualExpenses);
  const fireProgress = fireNumber > 0 ? Math.min(totalBalance / fireNumber, 1) : 0;

  // Expense breakdown by category
  const expensesByCategory = data.expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.effectiveAmount;
    return acc;
  }, {});
  const sortedExpenseCategories = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);

  // Source table filter options
  const sourceTableOptions = ['All', 'Excl. Non-Cash', ...Array.from(new Set(data.accounts.map(a => a.sourceTable)))];
  const sourceFilteredAccounts = sourceFilter === 'All'
    ? data.accounts
    : sourceFilter === 'Excl. Non-Cash'
    ? data.accounts.filter(a => a.sourceTable !== 'Non-Cash Assets')
    : data.accounts.filter(a => a.sourceTable === sourceFilter);

  // Account type filter options (applied after source filter)
  const accountTypeOptions = ['All', ...Array.from(new Set(sourceFilteredAccounts.map(a => accountTypeLabel(a.type))))];
  const filteredAccounts = accountFilter === 'All'
    ? sourceFilteredAccounts
    : sourceFilteredAccounts.filter(a => accountTypeLabel(a.type) === accountFilter);

  const expenseCategoryOptions = ['All', ...Array.from(new Set(data.expenses.map(e => e.category)))];
  const filteredExpenses = expenseFilter === 'All'
    ? data.expenses
    : data.expenses.filter(e => e.category === expenseFilter);

  // Data date (most recent snapshot or account update)
  const latestSnapshot = data.snapshots.length > 0 ? data.snapshots[data.snapshots.length - 1] : null;
  const dataDate = latestSnapshot?.date || (data.accounts.length > 0 ? data.accounts[0].lastUpdated : null);

  const navigateToAccount = (accountId: string, accountName: string) => {
    navigation.navigate('AccountDetail', { accountId, accountName });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { alignItems: 'center' }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      <View style={[styles.contentInner, { maxWidth: contentMaxWidth, width: '100%' }]}>
      {/* Net Worth Hero */}
      <View style={styles.heroSection}>
        <Text style={styles.heroLabel}>Net Worth</Text>
        <Text style={styles.heroAmount}>{formatCurrencyDecimal(totalBalance)}</Text>
        {dataDate && (
          <Text style={styles.heroDate}>as of {formatDate(dataDate)}</Text>
        )}
        {prevSnapshot && (
          <View style={styles.changeRow}>
            <View style={[styles.changeBadge, { backgroundColor: isPositive ? Colors.accentDim : 'rgba(255,80,0,0.08)' }]}>
              <Feather
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={14}
                color={isPositive ? Colors.positive : Colors.negative}
              />
              <Text style={[styles.changeText, { color: isPositive ? Colors.positive : Colors.negative }]}>
                {isPositive ? '+' : ''}{formatCurrency(netChange)} ({isPositive ? '+' : ''}{(netChangePercent * 100).toFixed(1)}%)
              </Text>
            </View>
            <Text style={styles.changePeriod}>since {formatDate(prevSnapshot.date)}</Text>
          </View>
        )}
      </View>

      {/* Net Worth Chart */}
      {chartData.length >= 2 && (
        <View style={styles.chartContainer}>
          <LargeChart
            data={chartData}
            width={chartWidth}
            height={200}
            color={Colors.accent}
          />
        </View>
      )}

      {/* Allocation Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allocation</Text>
        <View style={styles.allocationBar}>
          {sortedTypes.map(([label, balance], i) => {
            const pct = totalBalance > 0 ? (balance / totalBalance) * 100 : 0;
            if (pct < 1) return null;
            return (
              <View
                key={label}
                style={{
                  width: `${pct}%`,
                  height: 6,
                  backgroundColor: Colors.goalColors[i % Colors.goalColors.length],
                  borderRadius: i === 0 ? 3 : 0,
                  borderTopRightRadius: i === sortedTypes.length - 1 ? 3 : 0,
                  borderBottomRightRadius: i === sortedTypes.length - 1 ? 3 : 0,
                }}
              />
            );
          })}
        </View>
        <View style={styles.allocationGrid}>
          {sortedTypes.map(([label, balance], i) => (
            <View key={label} style={styles.allocationItem}>
              <View style={styles.allocationLabelRow}>
                <View style={[styles.dot, { backgroundColor: Colors.goalColors[i % Colors.goalColors.length] }]} />
                <Text style={styles.allocationLabel}>{label}</Text>
              </View>
              <Text style={styles.allocationAmount}>{formatCurrency(balance)}</Text>
              <Text style={styles.allocationPct}>
                {totalBalance > 0 ? ((balance / totalBalance) * 100).toFixed(1) : '0'}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Financial Insights */}
      {data.expenses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Insights</Text>

          {/* FIRE Progress */}
          <View style={styles.insightTile}>
            <View style={styles.insightHeader}>
              <View style={styles.insightLabelRow}>
                <Feather name="target" size={16} color={Colors.accent} />
                <Text style={styles.insightLabel}>FIRE Number</Text>
              </View>
              <Text style={styles.insightValue}>{formatCurrency(fireNumber)}</Text>
            </View>
            <ProgressBar progress={fireProgress} color={Colors.accent} height={6} />
            <Text style={styles.insightSubtext}>
              {(fireProgress * 100).toFixed(1)}% to financial independence (4% rule)
            </Text>
          </View>

          {/* Monthly Expenses */}
          <View style={styles.insightTile}>
            <View style={styles.insightHeader}>
              <View style={styles.insightLabelRow}>
                <Feather name="credit-card" size={16} color={Colors.negative} />
                <Text style={styles.insightLabel}>Monthly Expenses</Text>
              </View>
              <Text style={[styles.insightValue, { color: Colors.negative }]}>
                -{formatCurrency(totalMonthlyExpenses)}
              </Text>
            </View>
            {sortedExpenseCategories.map(([category, amount], i) => (
              <View key={category} style={styles.categoryRow}>
                <View style={styles.categoryLabelRow}>
                  <View style={[styles.dot, { backgroundColor: Colors.goalColors[i % Colors.goalColors.length] }]} />
                  <Text style={styles.categoryLabel}>{category}</Text>
                </View>
                <Text style={styles.categoryAmount}>
                  {formatCurrency(amount)}/mo ({totalMonthlyExpenses > 0 ? ((amount / totalMonthlyExpenses) * 100).toFixed(0) : 0}%)
                </Text>
              </View>
            ))}
          </View>

          {/* Annual Burn */}
          <View style={styles.insightRow}>
            <View style={styles.insightStat}>
              <Text style={styles.insightStatLabel}>Annual Expenses</Text>
              <Text style={styles.insightStatValue}>{formatCurrency(annualExpenses)}</Text>
            </View>
            <View style={styles.insightStat}>
              <Text style={styles.insightStatLabel}>Runway</Text>
              <Text style={styles.insightStatValue}>
                {totalMonthlyExpenses > 0 ? (totalBalance / totalMonthlyExpenses).toFixed(0) : '∞'} mo
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Account Tiles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <FilterChips options={sourceTableOptions} selected={sourceFilter} onSelect={setSourceFilter} />
        <FilterChips options={accountTypeOptions} selected={accountFilter} onSelect={setAccountFilter} />
        {filteredAccounts.map((account) => (
          <TouchableOpacity
            key={account.id}
            style={styles.accountTile}
            activeOpacity={0.6}
            onPress={() => navigateToAccount(account.id, account.name)}
          >
            <View style={styles.accountTileLeft}>
              <View style={styles.accountIcon}>
                <Feather
                  name={
                    account.type === 'crypto' ? 'activity' :
                    account.type === 'real_estate' ? 'home' :
                    account.type === 'vehicle' ? 'truck' :
                    account.type === '401k' || account.type === 'roth_ira' || account.type === 'traditional_ira' ? 'shield' :
                    account.type === 'savings' || account.type === 'hsa' ? 'dollar-sign' :
                    'credit-card'
                  }
                  size={18}
                  color={Colors.accent}
                />
              </View>
              <View>
                <Text style={styles.accountTileName}>{account.name}</Text>
                <Text style={styles.accountTileMeta}>
                  {accountTypeLabel(account.type)}{account.institution ? ` · ${account.institution}` : ''}
                  {account.lastUpdated ? ` · ${formatDate(account.lastUpdated)}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.accountTileRight}>
              <Text style={[styles.accountTileBalance, account.balance < 0 && { color: Colors.negative }]}>
                {formatCurrencyDecimal(account.balance)}
              </Text>
              <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Monthly Expenses */}
      {data.expenses && data.expenses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Expenses</Text>
          <FilterChips options={expenseCategoryOptions} selected={expenseFilter} onSelect={setExpenseFilter} />
          {filteredExpenses.map((expense) => (
            <View key={expense.id} style={styles.expenseRow}>
              <View>
                <Text style={styles.expenseName}>{expense.name}</Text>
                <Text style={styles.expenseMeta}>
                  {expense.category} · {expense.frequency}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>
                -{formatCurrency(expense.effectiveAmount)}/mo
              </Text>
            </View>
          ))}
          <View style={styles.expenseTotalRow}>
            <Text style={styles.expenseTotalLabel}>{expenseFilter === 'All' ? 'Total Monthly' : `${expenseFilter} Total`}</Text>
            <Text style={styles.expenseTotalAmount}>
              -{formatCurrency(filteredExpenses.reduce((sum, e) => sum + e.effectiveAmount, 0))}
            </Text>
          </View>
        </View>
      )}

      {/* Goals Quick View */}
      {data.goals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals</Text>
          {data.goals.map((goal) => {
            const goalCurrent = goal.linkedAccountIds && goal.linkedAccountIds.length > 0
              ? data.accounts
                  .filter(a => goal.linkedAccountIds!.includes(a.id))
                  .reduce((sum, a) => sum + a.balance, 0)
              : goal.currentAmount;
            const progress = goal.targetAmount > 0 ? goalCurrent / goal.targetAmount : 0;
            const remaining = Math.max(0, goal.targetAmount - goalCurrent);
            const goalTargetDate = new Date(goal.targetDate);
            const nowDate = new Date();
            const monthsLeft = Math.max(
              0,
              (goalTargetDate.getFullYear() - nowDate.getFullYear()) * 12 +
                (goalTargetDate.getMonth() - nowDate.getMonth())
            );
            const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : 0;
            const linkedAccounts = goal.linkedAccountIds
              ? data.accounts.filter(a => goal.linkedAccountIds!.includes(a.id))
              : [];
            return (
              <View key={goal.id} style={styles.goalTile}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalPercent}>{(Math.min(progress, 1) * 100).toFixed(0)}%</Text>
                </View>
                <ProgressBar progress={Math.min(progress, 1)} color={goal.color} height={6} />
                <View style={styles.goalFooter}>
                  <Text style={styles.goalFooterText}>
                    {formatCurrency(goalCurrent)} of {formatCurrency(goal.targetAmount)}
                  </Text>
                  {remaining > 0 && monthsLeft > 0 && (
                    <Text style={styles.goalFooterText}>
                      {formatCurrency(monthlyNeeded)}/mo for {monthsLeft}mo
                    </Text>
                  )}
                  {remaining > 0 && monthsLeft === 0 && (
                    <Text style={[styles.goalFooterText, { color: Colors.negative }]}>
                      Past due · {formatCurrency(remaining)} left
                    </Text>
                  )}
                </View>
                {linkedAccounts.length > 0 && (
                  <View style={styles.goalLinkedAccounts}>
                    {linkedAccounts.map(a => (
                      <Text key={a.id} style={styles.goalLinkedAccountText}>
                        {a.name}: {formatCurrencyDecimal(a.balance)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
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
  heroSection: {
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
  heroDate: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
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
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  // Allocation
  allocationBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  allocationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  allocationItem: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    width: '48%',
    minWidth: 140,
  },
  allocationLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  allocationLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  allocationAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  allocationPct: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  // Financial Insights
  insightTile: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  insightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  insightLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  insightValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  insightSubtext: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  insightRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  insightStat: {
    flex: 1,
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  insightStatLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  insightStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  categoryAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  // Account Tiles
  accountTile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  accountTileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  accountTileName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  accountTileMeta: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  accountTileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  accountTileBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  // Expenses
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  expenseName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  expenseMeta: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  expenseAmount: {
    color: Colors.negative,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  expenseTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  expenseTotalLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  expenseTotalAmount: {
    color: Colors.negative,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  // Goals
  goalTile: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  goalName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  goalPercent: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  goalFooterText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
  goalLinkedAccounts: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  goalLinkedAccountText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    paddingVertical: 1,
  },
});
