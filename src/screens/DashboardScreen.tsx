import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { AppData, Goal } from '../types';
import { loadAppData, syncWithAirtable, loadAirtableConfig, reorderGoals } from '../storage';
import { formatCurrency, formatCurrencyDecimal, formatDate, accountTypeLabel, formatAgeYear } from '../utils/format';
import LargeChart from '../components/LargeChart';
import ProgressBar from '../components/ProgressBar';

export default function DashboardScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;
  const [data, setData] = useState<AppData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [includeNonCash, setIncludeNonCash] = useState(false);
  const [expenseExpanded, setExpenseExpanded] = useState(false);
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

  // Filter accounts based on non-cash toggle
  const visibleAccounts = includeNonCash
    ? data.accounts
    : data.accounts.filter(a => a.sourceTable !== 'Non-Cash Assets');

  const totalBalance = visibleAccounts.reduce((sum, a) => sum + a.balance, 0);
  const prevSnapshot = data.snapshots.length > 1 ? data.snapshots[data.snapshots.length - 2] : null;
  const netChange = prevSnapshot ? totalBalance - prevSnapshot.netWorth : 0;
  const netChangePercent = prevSnapshot && prevSnapshot.netWorth > 0 ? netChange / prevSnapshot.netWorth : 0;
  const isPositive = netChange >= 0;

  const chartData = data.snapshots.map((s) => ({
    label: formatDate(s.date),
    value: s.netWorth,
  }));

  // Burn rate
  const totalMonthlyExpenses = data.expenses.reduce((sum, e) => sum + e.effectiveAmount, 0);
  const expensesByCategory = data.expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.effectiveAmount;
    return acc;
  }, {});
  const sortedExpenseCategories = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);

  // Goals sorted by priority
  const sortedGoals = [...data.goals].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  const getGoalCurrent = (goal: Goal): number => {
    if (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) {
      return data.accounts
        .filter(a => goal.linkedAccountIds!.includes(a.id))
        .reduce((sum, a) => sum + a.balance, 0);
    }
    return goal.currentAmount;
  };

  const moveGoal = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sortedGoals.length) return;
    const reordered = [...sortedGoals];
    const tmp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = tmp;
    const updated = await reorderGoals(reordered.map(g => g.id));
    setData(updated);
  };

  // Emergency runway: based on Emergency HYS only
  const emergencyAccount = data.accounts.find(a => a.name.toLowerCase().includes('emergency'));
  const emergencyBalance = emergencyAccount ? emergencyAccount.balance : 0;
  const emergencyRunwayMonths = totalMonthlyExpenses > 0 ? emergencyBalance / totalMonthlyExpenses : 0;

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

      {/* Accounts grouped by type */}
      <View style={styles.section}>
        <View style={styles.accountsSectionHeader}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          <View style={styles.nonCashToggle}>
            <Text style={styles.nonCashToggleLabel}>Non-Cash</Text>
            <Switch
              value={includeNonCash}
              onValueChange={setIncludeNonCash}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>
        <View style={styles.accountGrid}>
          {visibleAccounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={styles.accountGridTile}
              activeOpacity={0.6}
              onPress={() => navigateToAccount(account.id, account.name)}
            >
              <Text style={styles.accountGridName} numberOfLines={1}>{account.name}</Text>
              <Text style={[styles.accountGridBalance, account.balance < 0 && { color: Colors.negative }]}>
                {formatCurrencyDecimal(account.balance)}
              </Text>
              <Text style={styles.accountGridMeta} numberOfLines={1}>
                {accountTypeLabel(account.type)}{account.institution ? ` · ${account.institution}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Goals — tiered & prioritized */}
      {sortedGoals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <Text style={styles.goalSubtitle}>Reorder priority — contributions waterfall top-down</Text>
          {sortedGoals.map((goal, index) => {
            const goalCurrent = getGoalCurrent(goal);
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
            return (
              <View key={goal.id} style={styles.goalTile}>
                <View style={styles.goalRankRow}>
                  <View style={styles.goalRankBadge}>
                    <Text style={styles.goalRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.goalRankArrows}>
                    <TouchableOpacity
                      onPress={() => moveGoal(index, -1)}
                      disabled={index === 0}
                      style={[styles.goalArrow, index === 0 && styles.goalArrowDisabled]}
                    >
                      <Feather name="chevron-up" size={18} color={index === 0 ? Colors.border : Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveGoal(index, 1)}
                      disabled={index === sortedGoals.length - 1}
                      style={[styles.goalArrow, index === sortedGoals.length - 1 && styles.goalArrowDisabled]}
                    >
                      <Feather name="chevron-down" size={18} color={index === sortedGoals.length - 1 ? Colors.border : Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
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
                <Text style={styles.goalFooterText}>{formatAgeYear(goal.targetDate)}</Text>
                {goal.milestoneReward && (
                  <View style={styles.rewardBadge}>
                    <Feather name="gift" size={12} color={Colors.accent} />
                    <Text style={styles.rewardText}>{goal.milestoneReward}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Emergency Runway */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Runway</Text>
        <View style={styles.runwayCard}>
          <View style={styles.runwayTop}>
            <View style={styles.runwayIconWrap}>
              <Feather name="shield" size={22} color={emergencyRunwayMonths >= 6 ? Colors.positive : Colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.runwayMonths}>
                {emergencyRunwayMonths.toFixed(1)} months
              </Text>
              <Text style={styles.runwayHint}>
                {emergencyRunwayMonths >= 6 ? 'On track' : emergencyRunwayMonths >= 3 ? 'Building' : 'Below target'}
                {' · '}recommended 6 months
              </Text>
            </View>
          </View>
          <ProgressBar progress={Math.min(emergencyRunwayMonths / 6, 1)} color={emergencyRunwayMonths >= 6 ? Colors.positive : Colors.warning} height={6} />
          <View style={styles.runwayDetails}>
            <View style={styles.runwayDetail}>
              <Text style={styles.runwayDetailLabel}>Emergency HYS</Text>
              <Text style={styles.runwayDetailValue}>{formatCurrency(emergencyBalance)}</Text>
            </View>
            <View style={styles.runwayDetail}>
              <Text style={styles.runwayDetailLabel}>Monthly Expenses</Text>
              <Text style={styles.runwayDetailValue}>{formatCurrency(totalMonthlyExpenses)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Expenses — collapsed burn rate */}
      {data.expenses.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.burnRateCard}
            activeOpacity={0.7}
            onPress={() => setExpenseExpanded(!expenseExpanded)}
          >
            <View style={styles.burnRateLeft}>
              <Feather name="repeat" size={18} color={Colors.negative} />
              <View style={{ marginLeft: Spacing.sm }}>
                <Text style={styles.burnRateLabel}>Expenses</Text>
                <Text style={styles.burnRateRunway}>
                  {formatCurrency(totalMonthlyExpenses)}/mo burn rate
                </Text>
              </View>
            </View>
            <View style={styles.burnRateRight}>
              <Text style={styles.burnRateAmount}>-{formatCurrency(totalMonthlyExpenses)}</Text>
              <Feather name={expenseExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
          {expenseExpanded && (
            <View style={styles.burnRateExpanded}>
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
          )}
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
  // Burn Rate
  burnRateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  burnRateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  burnRateLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  burnRateRunway: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  burnRateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  burnRateAmount: {
    color: Colors.negative,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  burnRateExpanded: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
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
  // Accounts
  accountsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  nonCashToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nonCashToggleLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  accountGridTile: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    width: '48.5%',
    minWidth: 150,
  },
  accountGridName: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  accountGridBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  accountGridMeta: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
  // Goals
  goalSubtitle: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginBottom: Spacing.md,
  },
  goalTile: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  goalRankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  goalRankBadge: {
    backgroundColor: Colors.accentDim,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 2,
  },
  goalRankText: {
    color: Colors.accent,
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  goalRankArrows: {
    flexDirection: 'row',
    gap: 2,
  },
  goalArrow: {
    padding: 2,
  },
  goalArrowDisabled: {
    opacity: 0.3,
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
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentDim,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    gap: 4,
  },
  rewardText: {
    color: Colors.accent,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  // Emergency Runway
  runwayCard: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  runwayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  runwayIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runwayMonths: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  runwayHint: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  runwayDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  runwayDetail: {
    alignItems: 'center',
  },
  runwayDetailLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  runwayDetailValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});
