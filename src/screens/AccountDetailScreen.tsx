import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius, useTheme } from '../theme';
import { Account, AccountType, AppData } from '../types';
import { loadAppData, saveAccount } from '../storage';
import { formatCurrency, formatCurrencyDecimal, formatDate, accountTypeLabel } from '../utils/format';
import LargeChart from '../components/LargeChart';
import MiniChart from '../components/MiniChart';
import InputField from '../components/InputField';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'traditional_ira', label: 'Traditional IRA' },
  { value: 'roth_ira', label: 'Roth IRA' },
  { value: '401k', label: '401(k)' },
  { value: 'hsa', label: 'HSA' },
  { value: '529', label: '529 Plan' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
];

const FORECAST_YEARS = [1, 3, 5, 10];

export default function AccountDetailScreen() {
  const route = useRoute<any>();
  const { accountId } = route.params;
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();

  const [data, setData] = useState<AppData | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editType, setEditType] = useState<AccountType>('checking');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [forecastYears, setForecastYears] = useState(5);

  useFocusEffect(
    useCallback(() => {
      loadAppData().then(setData);
    }, [])
  );

  // Compute derived values safely for hooks (before early returns)
  const account = data?.accounts.find((a) => a.id === accountId) ?? null;
  const currentBalance = account?.balance ?? 0;
  const hasRate = account?.interestRate !== undefined && (account?.interestRate ?? 0) > 0;
  const rate = hasRate ? account!.interestRate! : 0;

  const forecastData = useMemo(() => {
    if (!hasRate || !account) return [];
    const points: { label: string; value: number }[] = [];
    const now = new Date();
    points.push({ label: 'Now', value: currentBalance });
    const months = forecastYears * 12;
    const step = Math.max(1, Math.floor(months / 24));
    for (let m = step; m <= months; m += step) {
      const val = currentBalance * Math.pow(1 + rate / 12, m);
      const d = new Date(now.getFullYear(), now.getMonth() + m);
      const label = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      points.push({ label, value: val });
    }
    const finalVal = currentBalance * Math.pow(1 + rate / 12, months);
    const finalDate = new Date(now.getFullYear(), now.getMonth() + months);
    const lastPoint = points[points.length - 1];
    if (lastPoint && lastPoint.value !== finalVal) {
      points.push({ label: `${finalDate.toLocaleString('default', { month: 'short' })} ${finalDate.getFullYear()}`, value: finalVal });
    }
    return points;
  }, [hasRate, rate, currentBalance, forecastYears, account]);

  if (!data) return null;
  if (!account) return null;

  const projectedBalance = hasRate ? currentBalance * Math.pow(1 + rate / 12, forecastYears * 12) : 0;
  const projectedGain = projectedBalance - currentBalance;

  // Build historical balance data from snapshots
  const history = data.snapshots
    .filter((s) => s.accountBalances[accountId] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      date: s.date,
      balance: s.accountBalances[accountId],
    }));

  const today = new Date().toISOString().split('T')[0];
  const lastHistoryDate = history.length > 0 ? history[history.length - 1].date : '';
  if (lastHistoryDate !== today) {
    history.push({ date: today, balance: account.balance });
  }

  const chartData = history.map((h) => ({
    label: formatDate(h.date),
    value: h.balance,
  }));

  const sparklineData = history.map(h => h.balance);

  // Growth calculations
  const firstBalance = history.length > 0 ? history[0].balance : account.balance;
  const totalChange = currentBalance - firstBalance;
  const totalChangePct = firstBalance !== 0 ? totalChange / Math.abs(firstBalance) : 0;
  const isPositive = totalChange >= 0;

  // Period-over-period changes (latest 5)
  const periodChanges = history.length > 1
    ? history.slice(1).map((h, i) => {
        const prev = history[i];
        const change = h.balance - prev.balance;
        const pct = prev.balance !== 0 ? change / Math.abs(prev.balance) : 0;
        return { from: prev.date, to: h.date, fromBal: prev.balance, toBal: h.balance, change, pct };
      }).reverse().slice(0, 5)
    : [];

  const contentWidth = Math.min(screenWidth, 640);
  const chartWidth = contentWidth - 40;

  const openEdit = () => {
    setEditName(account.name);
    setEditBalance(account.balance.toString());
    setEditInstitution(account.institution);
    setEditType(account.type);
    setEditInterestRate(account.interestRate !== undefined ? (account.interestRate * 100).toFixed(2) : '');
    setShowTypePicker(false);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      const msg = 'Account name is required';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }
    const parsedRate = parseFloat(editInterestRate);
    const updated: Account = {
      ...account,
      name: editName.trim(),
      balance: parseFloat(editBalance) || 0,
      institution: editInstitution.trim(),
      type: editType,
      interestRate: !isNaN(parsedRate) && parsedRate > 0 ? parsedRate / 100 : undefined,
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    const newData = await saveAccount(updated);
    setData(newData);
    setEditModalVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={[styles.contentInner, { maxWidth: contentWidth }]}>

        {/* Compact Hero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={[styles.heroBalance, { color: colors.textPrimary }, account.balance < 0 && { color: colors.negative }]}>
                {formatCurrencyDecimal(account.balance)}
              </Text>
              {history.length > 1 && (
                <View style={[styles.changeBadge, { backgroundColor: isPositive ? colors.accentDim : 'rgba(255,80,0,0.08)' }]}>
                  <Feather
                    name={isPositive ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={isPositive ? colors.positive : colors.negative}
                  />
                  <Text style={[styles.changeText, { color: isPositive ? colors.positive : colors.negative }]}>
                    {isPositive ? '+' : ''}{formatCurrency(totalChange)} ({isPositive ? '+' : ''}{(totalChangePct * 100).toFixed(1)}%)
                  </Text>
                </View>
              )}
            </View>
            {sparklineData.length >= 2 && (
              <MiniChart data={sparklineData} width={100} height={40} color={isPositive ? colors.positive : colors.negative} showFill={false} />
            )}
          </View>

          {/* Metadata Chips */}
          <View style={styles.heroMeta}>
            <View style={[styles.metaChip, { backgroundColor: colors.tileBg }]}>
              <Feather name="briefcase" size={11} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{accountTypeLabel(account.type)}</Text>
            </View>
            {account.institution ? (
              <View style={[styles.metaChip, { backgroundColor: colors.tileBg }]}>
                <Feather name="home" size={11} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{account.institution}</Text>
              </View>
            ) : null}
            {hasRate && (
              <View style={[styles.metaChip, { backgroundColor: colors.accentDim }]}>
                <Feather name="percent" size={11} color={colors.accent} />
                <Text style={[styles.metaText, { color: colors.accent, fontWeight: '600' }]}>{(rate * 100).toFixed(2)}% APY</Text>
              </View>
            )}
            <TouchableOpacity onPress={openEdit} style={[styles.metaChip, { backgroundColor: colors.accentDim }]}>
              <Feather name="edit-2" size={11} color={colors.accent} />
              <Text style={[styles.metaText, { color: colors.accent, fontWeight: '600' }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance History Chart */}
        {chartData.length >= 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>BALANCE HISTORY</Text>
            <View style={[styles.chartCard, { backgroundColor: colors.tileBg }]}>
              <LargeChart
                data={chartData}
                width={chartWidth - 32}
                height={180}
                color={colors.accent}
              />
            </View>
          </View>
        )}

        {chartData.length < 2 && (
          <View style={styles.emptyChart}>
            <Feather name="bar-chart-2" size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Save 2+ snapshots to see balance trends
            </Text>
          </View>
        )}

        {/* Per-Account Forecast */}
        {hasRate && forecastData.length >= 2 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PROJECTED GROWTH</Text>
              <View style={styles.yearTabs}>
                {FORECAST_YEARS.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.yearTab, { borderColor: colors.border }, forecastYears === y && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => setForecastYears(y)}
                  >
                    <Text style={[styles.yearTabText, { color: colors.textSecondary }, forecastYears === y && { color: '#FFF' }]}>{y}Y</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.chartCard, { backgroundColor: colors.tileBg }]}>
              <View style={styles.projectionSummary}>
                <View>
                  <Text style={[styles.projLabel, { color: colors.textTertiary }]}>Projected in {forecastYears}yr</Text>
                  <Text style={[styles.projValue, { color: colors.textPrimary }]}>{formatCurrencyDecimal(projectedBalance)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.projLabel, { color: colors.textTertiary }]}>Interest earned</Text>
                  <Text style={[styles.projValue, { color: colors.positive }]}>+{formatCurrencyDecimal(projectedGain)}</Text>
                </View>
              </View>
              <LargeChart data={forecastData} width={chartWidth - 32} height={160} color="#6846EB" showLabels />
            </View>
          </View>
        )}

        {/* Details Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>DETAILS</Text>
          <View style={styles.detailsGrid}>
            <View style={[styles.detailCell, { backgroundColor: colors.tileBg }]}>
              <Text style={[styles.detailCellLabel, { color: colors.textTertiary }]}>Last Updated</Text>
              <Text style={[styles.detailCellValue, { color: colors.textPrimary }]}>{formatDate(account.lastUpdated)}</Text>
            </View>
            <View style={[styles.detailCell, { backgroundColor: colors.tileBg }]}>
              <Text style={[styles.detailCellLabel, { color: colors.textTertiary }]}>Data Points</Text>
              <Text style={[styles.detailCellValue, { color: colors.textPrimary }]}>{history.length}</Text>
            </View>
            {hasRate && (
              <View style={[styles.detailCell, { backgroundColor: colors.tileBg }]}>
                <Text style={[styles.detailCellLabel, { color: colors.textTertiary }]}>Monthly Yield</Text>
                <Text style={[styles.detailCellValue, { color: colors.positive }]}>
                  +{formatCurrencyDecimal(currentBalance * rate / 12)}/mo
                </Text>
              </View>
            )}
            {hasRate && (
              <View style={[styles.detailCell, { backgroundColor: colors.tileBg }]}>
                <Text style={[styles.detailCellLabel, { color: colors.textTertiary }]}>Annual Yield</Text>
                <Text style={[styles.detailCellValue, { color: colors.positive }]}>
                  +{formatCurrencyDecimal(currentBalance * rate)}/yr
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent Changes */}
        {periodChanges.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>RECENT CHANGES</Text>
            <View style={[styles.historyCard, { backgroundColor: colors.tileBg }]}>
              {periodChanges.map((c, i) => {
                const cPositive = c.change >= 0;
                return (
                  <View key={i} style={[styles.historyRow, i < periodChanges.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <Text style={[styles.historyDate, { color: colors.textSecondary }]}>{formatDate(c.to)}</Text>
                    <Text style={[styles.historyBal, { color: colors.textPrimary }]}>{formatCurrencyDecimal(c.toBal)}</Text>
                    <Text style={[styles.historyChange, { color: cPositive ? colors.positive : colors.negative }]}>
                      {cPositive ? '+' : ''}{formatCurrency(c.change)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        </View>
      </ScrollView>

      {/* Edit Modal — sticky header */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            {/* Sticky Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalHeaderBtn}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Account</Text>
              <TouchableOpacity onPress={handleSave} style={styles.modalHeaderBtn}>
                <Text style={[styles.modalHeaderSave, { color: colors.accent }]}>Save</Text>
              </TouchableOpacity>
            </View>
            {/* Scrollable Content */}
            <ScrollView style={styles.modalScroll} bounces={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalBody}>
                <InputField label="Account Name" value={editName} onChangeText={setEditName} />
                <InputField
                  label="Balance"
                  value={editBalance}
                  onChangeText={setEditBalance}
                  keyboardType="decimal-pad"
                />
                <InputField
                  label="Institution"
                  value={editInstitution}
                  onChangeText={setEditInstitution}
                  placeholder="e.g. Fidelity"
                />

                <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>Account Type</Text>
                <TouchableOpacity style={[styles.typePicker, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => setShowTypePicker(!showTypePicker)}>
                  <Text style={[styles.typePickerText, { color: colors.textPrimary }]}>{accountTypeLabel(editType)}</Text>
                  <Feather name={showTypePicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <InputField
                  label="Annual Interest Rate (%)"
                  value={editInterestRate}
                  onChangeText={setEditInterestRate}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 4.5"
                />

                {showTypePicker && (
                  <ScrollView style={[styles.typeList, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} nestedScrollEnabled>
                    {ACCOUNT_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.value}
                        style={[styles.typeItem, { borderBottomColor: colors.border }, editType === t.value && { backgroundColor: colors.accentDim }]}
                        onPress={() => { setEditType(t.value); setShowTypePicker(false); }}
                      >
                        <Text style={[styles.typeItemText, { color: colors.textPrimary }, editType === t.value && { color: colors.accent, fontWeight: '600' }]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.xxl,
  },
  contentInner: {
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLeft: {
    flex: 1,
  },
  heroBalance: {
    fontSize: FontSizes.hero,
    fontWeight: '800',
    letterSpacing: -1,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    gap: 4,
    marginTop: Spacing.xs,
  },
  changeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  metaText: {
    fontSize: FontSizes.xs,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  chartCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  yearTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  yearTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
  },
  yearTabText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  projectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  projLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 2,
  },
  projValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  detailCell: {
    flex: 1,
    minWidth: '45%',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  detailCellLabel: {
    fontSize: FontSizes.xs,
    marginBottom: 4,
  },
  detailCellValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  historyCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  historyDate: {
    flex: 1,
    fontSize: FontSizes.sm,
  },
  historyBal: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  historyChange: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textAlign: 'right',
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  // Modal — sticky header pattern
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '92%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalHeaderBtn: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderSave: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
  },
  modalBody: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  typeLabel: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  typePicker: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typePickerText: {
    fontSize: FontSizes.md,
  },
  typeList: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
    maxHeight: 200,
  },
  typeItem: {
    padding: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  typeItemText: {
    fontSize: FontSizes.md,
  },
});
