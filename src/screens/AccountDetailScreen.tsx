import React, { useCallback, useState } from 'react';
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
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
];

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
  const [showTypePicker, setShowTypePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAppData().then(setData);
    }, [])
  );

  if (!data) return null;

  const account = data.accounts.find((a) => a.id === accountId);
  if (!account) return null;

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

  // Growth calculations
  const firstBalance = history.length > 0 ? history[0].balance : account.balance;
  const currentBalance = account.balance;
  const totalChange = currentBalance - firstBalance;
  const totalChangePct = firstBalance !== 0 ? totalChange / Math.abs(firstBalance) : 0;
  const isPositive = totalChange >= 0;

  // Period-over-period changes
  const periodChanges = history.length > 1
    ? history.slice(1).map((h, i) => {
        const prev = history[i];
        const change = h.balance - prev.balance;
        const pct = prev.balance !== 0 ? change / Math.abs(prev.balance) : 0;
        return { from: prev.date, to: h.date, fromBal: prev.balance, toBal: h.balance, change, pct };
      }).reverse()
    : [];

  const openEdit = () => {
    setEditName(account.name);
    setEditBalance(account.balance.toString());
    setEditInstitution(account.institution);
    setEditType(account.type);
    setShowTypePicker(false);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      const msg = 'Account name is required';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }
    const updated: Account = {
      ...account,
      name: editName.trim(),
      balance: parseFloat(editBalance) || 0,
      institution: editInstitution.trim(),
      type: editType,
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    const newData = await saveAccount(updated);
    setData(newData);
    setEditModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={styles.contentInner}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[styles.heroBalance, account.balance < 0 && { color: Colors.negative }]}>
            {formatCurrencyDecimal(account.balance)}
          </Text>
          {history.length > 1 && (
            <View style={styles.changeRow}>
              <View style={[styles.changeBadge, { backgroundColor: isPositive ? Colors.accentDim : 'rgba(255,80,0,0.08)' }]}>
                <Feather
                  name={isPositive ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={isPositive ? Colors.positive : Colors.negative}
                />
                <Text style={[styles.changeText, { color: isPositive ? Colors.positive : Colors.negative }]}>
                  {isPositive ? '+' : ''}{formatCurrency(totalChange)} ({isPositive ? '+' : ''}{(totalChangePct * 100).toFixed(1)}%)
                </Text>
              </View>
              <Text style={styles.changePeriod}>all time</Text>
            </View>
          )}
        </View>

        {/* Balance History Chart */}
        {chartData.length >= 2 && (
          <View style={styles.chartContainer}>
            <LargeChart
              data={chartData}
              width={Math.min(screenWidth - 40, 800)}
              height={220}
              color={Colors.accent}
            />
          </View>
        )}

        {chartData.length < 2 && (
          <View style={styles.emptyChart}>
            <Feather name="bar-chart-2" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>
              Save at least 2 snapshots to see balance trends
            </Text>
          </View>
        )}

        {/* Edit Button */}
        <TouchableOpacity style={styles.editButton} onPress={openEdit}>
          <Feather name="edit-2" size={16} color={Colors.accent} />
          <Text style={styles.editButtonText}>Edit Account</Text>
        </TouchableOpacity>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailTile}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{accountTypeLabel(account.type)}</Text>
            </View>
            {account.institution ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Institution</Text>
                <Text style={styles.detailValue}>{account.institution}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Updated</Text>
              <Text style={styles.detailValue}>{formatDate(account.lastUpdated)}</Text>
            </View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Data Points</Text>
              <Text style={styles.detailValue}>{history.length} snapshot{history.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>

        {/* Period Changes */}
        {periodChanges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>History</Text>
            {periodChanges.map((c, i) => {
              const cPositive = c.change >= 0;
              return (
                <View key={i} style={styles.periodTile}>
                  <View>
                    <Text style={styles.periodDates}>
                      {formatDate(c.from)} → {formatDate(c.to)}
                    </Text>
                    <Text style={styles.periodBalance}>
                      {formatCurrencyDecimal(c.toBal)}
                    </Text>
                  </View>
                  <View style={styles.periodRight}>
                    <Text style={[styles.periodChange, { color: cPositive ? Colors.positive : Colors.negative }]}>
                      {cPositive ? '+' : ''}{formatCurrency(c.change)}
                    </Text>
                    <Text style={[styles.periodPct, { color: cPositive ? Colors.positive : Colors.negative }]}>
                      {cPositive ? '+' : ''}{(c.pct * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Account</Text>
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

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingBottom: Spacing.xxl,
  },
  contentInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  heroBalance: {
    fontSize: FontSizes.hero,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
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
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  chartContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  editButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accentDim,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  editButtonText: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  detailTile: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  detailValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  periodTile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  periodDates: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  periodBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginTop: 2,
  },
  periodRight: {
    alignItems: 'flex-end',
  },
  periodChange: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  periodPct: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '85%',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.lg,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
});
