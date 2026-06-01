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
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
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

  if (!data) return null;

  const account = data.accounts.find((a) => a.id === accountId);
  if (!account) return null;

  const contentWidth = Math.min(screenWidth, 640);

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
  const currentBalance = account.balance;
  const totalChange = currentBalance - firstBalance;
  const totalChangePct = firstBalance !== 0 ? totalChange / Math.abs(firstBalance) : 0;
  const isPositive = totalChange >= 0;

  // Period-over-period changes (latest 5 only)
  const periodChanges = history.length > 1
    ? history.slice(1).map((h, i) => {
        const prev = history[i];
        const change = h.balance - prev.balance;
        const pct = prev.balance !== 0 ? change / Math.abs(prev.balance) : 0;
        return { from: prev.date, to: h.date, fromBal: prev.balance, toBal: h.balance, change, pct };
      }).reverse().slice(0, 5)
    : [];

  // Forecast projection (compound interest)
  const hasRate = account.interestRate !== undefined && account.interestRate > 0;
  const rate = hasRate ? account.interestRate! : 0;
  const forecastData = useMemo(() => {
    if (!hasRate) return [];
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
    // Ensure last point
    const finalVal = currentBalance * Math.pow(1 + rate / 12, months);
    const finalDate = new Date(now.getFullYear(), now.getMonth() + months);
    const lastPoint = points[points.length - 1];
    if (lastPoint && lastPoint.value !== finalVal) {
      points.push({ label: `${finalDate.toLocaleString('default', { month: 'short' })} ${finalDate.getFullYear()}`, value: finalVal });
    }
    return points;
  }, [hasRate, rate, currentBalance, forecastYears]);

  const projectedBalance = hasRate ? currentBalance * Math.pow(1 + rate / 12, forecastYears * 12) : 0;
  const projectedGain = projectedBalance - currentBalance;

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

  const chartWidth = Math.min(screenWidth - 32, 608);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.contentInner, { maxWidth: contentWidth }]}>

          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroLeft}>
                <Text style={[styles.heroBalance, account.balance < 0 && { color: Colors.negative }]}>
                  {formatCurrencyDecimal(account.balance)}
                </Text>
                {history.length > 1 && (
                  <View style={[styles.changeBadge, { backgroundColor: isPositive ? Colors.accentDim : 'rgba(255,80,0,0.08)' }]}>
                    <Feather
                      name={isPositive ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={isPositive ? Colors.positive : Colors.negative}
                    />
                    <Text style={[styles.changeText, { color: isPositive ? Colors.positive : Colors.negative }]}>
                      {isPositive ? '+' : ''}{formatCurrency(totalChange)} ({isPositive ? '+' : ''}{(totalChangePct * 100).toFixed(1)}%)
                    </Text>
                  </View>
                )}
              </View>
              {sparklineData.length >= 2 && (
                <MiniChart
                  data={sparklineData}
                  width={100}
                  height={40}
                  color={isPositive ? Colors.positive : Colors.negative}
                  showFill={false}
                />
              )}
            </View>
            <View style={styles.heroMeta}>
              <View style={styles.metaChip}>
                <Feather name="briefcase" size={11} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{accountTypeLabel(account.type)}</Text>
              </View>
              {account.institution ? (
                <View style={styles.metaChip}>
                  <Feather name="home" size={11} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{account.institution}</Text>
                </View>
              ) : null}
              {hasRate && (
                <View style={[styles.metaChip, { backgroundColor: Colors.accentDim }]}>
                  <Feather name="percent" size={11} color={Colors.accent} />
                  <Text style={[styles.metaText, { color: Colors.accent, fontWeight: '600' }]}>{(rate * 100).toFixed(2)}% APY</Text>
                </View>
              )}
              <TouchableOpacity onPress={openEdit} style={styles.editChip}>
                <Feather name="edit-2" size={11} color={Colors.accent} />
                <Text style={[styles.metaText, { color: Colors.accent, fontWeight: '600' }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Balance History Chart ── */}
          {chartData.length >= 2 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BALANCE HISTORY</Text>
              <View style={styles.chartCard}>
                <LargeChart
                  data={chartData}
                  width={chartWidth}
                  height={180}
                  color={Colors.accent}
                />
              </View>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Feather name="bar-chart-2" size={24} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>Save snapshots to see balance trends</Text>
            </View>
          )}

          {/* ── Interest Rate Forecast ── */}
          {hasRate && forecastData.length >= 2 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>PROJECTED GROWTH</Text>
                <View style={styles.yearTabs}>
                  {FORECAST_YEARS.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.yearTab, forecastYears === y && styles.yearTabActive]}
                      onPress={() => setForecastYears(y)}
                    >
                      <Text style={[styles.yearTabText, forecastYears === y && styles.yearTabTextActive]}>{y}Y</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.chartCard}>
                <View style={styles.projectionSummary}>
                  <View>
                    <Text style={styles.projLabel}>Projected in {forecastYears}yr</Text>
                    <Text style={styles.projValue}>{formatCurrencyDecimal(projectedBalance)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.projLabel}>Interest earned</Text>
                    <Text style={[styles.projValue, { color: Colors.positive }]}>+{formatCurrencyDecimal(projectedGain)}</Text>
                  </View>
                </View>
                <LargeChart
                  data={forecastData}
                  width={chartWidth}
                  height={160}
                  color="#6846EB"
                  showLabels
                />
              </View>
            </View>
          )}

          {/* ── Details Grid ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailCell}>
                <Text style={styles.detailCellLabel}>Last Updated</Text>
                <Text style={styles.detailCellValue}>{formatDate(account.lastUpdated)}</Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailCellLabel}>Data Points</Text>
                <Text style={styles.detailCellValue}>{history.length}</Text>
              </View>
              {hasRate && (
                <View style={styles.detailCell}>
                  <Text style={styles.detailCellLabel}>Monthly Yield</Text>
                  <Text style={[styles.detailCellValue, { color: Colors.positive }]}>
                    +{formatCurrencyDecimal(currentBalance * rate / 12)}/mo
                  </Text>
                </View>
              )}
              {hasRate && (
                <View style={styles.detailCell}>
                  <Text style={styles.detailCellLabel}>Annual Yield</Text>
                  <Text style={[styles.detailCellValue, { color: Colors.positive }]}>
                    +{formatCurrencyDecimal(currentBalance * rate)}/yr
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Period Changes ── */}
          {periodChanges.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RECENT CHANGES</Text>
              <View style={styles.historyCard}>
                {periodChanges.map((c, i) => {
                  const cPositive = c.change >= 0;
                  return (
                    <View key={i} style={[styles.historyRow, i < periodChanges.length - 1 && styles.historyRowBorder]}>
                      <Text style={styles.historyDate}>{formatDate(c.to)}</Text>
                      <Text style={styles.historyBal}>{formatCurrencyDecimal(c.toBal)}</Text>
                      <Text style={[styles.historyChange, { color: cPositive ? Colors.positive : Colors.negative }]}>
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

      {/* ── Edit Modal ── */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} bounces={false} keyboardShouldPersistTaps="handled">
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalHeaderBtn}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Account</Text>
              <TouchableOpacity onPress={handleSave} style={styles.modalHeaderBtn}>
                <Text style={styles.modalHeaderSave}>Save</Text>
              </TouchableOpacity>
            </View>
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

            <Text style={styles.typeLabel}>Account Type</Text>
            <TouchableOpacity style={styles.typePicker} onPress={() => setShowTypePicker(!showTypePicker)}>
              <Text style={styles.typePickerText}>{accountTypeLabel(editType)}</Text>
              <Feather name={showTypePicker ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <InputField
              label="Annual Interest Rate (%)"
              value={editInterestRate}
              onChangeText={setEditInterestRate}
              keyboardType="decimal-pad"
              placeholder="e.g. 4.5"
            />

            {showTypePicker && (
              <ScrollView style={styles.typeList} nestedScrollEnabled>
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeItem, editType === t.value && styles.typeItemActive]}
                    onPress={() => { setEditType(t.value); setShowTypePicker(false); }}
                  >
                    <Text style={[styles.typeItemText, editType === t.value && styles.typeItemTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

          </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  contentInner: {
    width: '100%',
    alignSelf: 'center',
  },

  // ── Hero ──
  hero: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLeft: {
    flex: 1,
  },
  heroBalance: {
    fontSize: FontSizes.hero,
    fontWeight: '800',
    color: Colors.textPrimary,
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
    marginTop: 6,
  },
  changeText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm + 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.tileBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  metaText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.accentDim,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
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
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },

  // ── Charts ──
  chartCard: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  emptyChart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },

  // ── Forecast year tabs ──
  yearTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  yearTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.tileBg,
  },
  yearTabActive: {
    backgroundColor: Colors.accent,
  },
  yearTabText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  yearTabTextActive: {
    color: '#FFF',
  },
  projectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  projLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  projValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // ── Details Grid ──
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  detailCell: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minWidth: 140,
    flex: 1,
  },
  detailCellLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  detailCellValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // ── History ──
  historyCard: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyDate: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  historyBal: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  historyChange: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textAlign: 'right',
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalScroll: {
    maxHeight: '92%',
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderBtn: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderSave: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  typeLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  typePicker: {
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typePickerText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
  typeList: {
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    maxHeight: 200,
  },
  typeItem: {
    padding: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  typeItemActive: {
    backgroundColor: Colors.accentDim,
  },
  typeItemText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
  typeItemTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
