import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { Account, AccountType, AppData } from '../types';
import { loadAppData, saveAccount, deleteAccount, saveSnapshot } from '../storage';
import { formatCurrencyDecimal, formatDate, accountTypeLabel } from '../utils/format';
import InputField from '../components/InputField';
import FilterChips from '../components/FilterChips';

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

export default function AccountsScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('Excl. Non-Cash');
  const [typeFilter, setTypeFilter] = useState('All');
  const navigation = useNavigation<any>();

  const loadData = useCallback(async () => {
    const appData = await loadAppData();
    setData(appData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openAdd = () => {
    setEditingAccount(null);
    setName('');
    setType('checking');
    setBalance('');
    setInstitution('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !balance.trim()) {
      const msg = 'Name and balance are required';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }
    const account: Account = {
      id: editingAccount?.id || uuidv4(),
      name: name.trim(),
      type,
      balance: parseFloat(balance) || 0,
      institution: institution.trim(),
      lastUpdated: new Date().toISOString().split('T')[0],
      sourceTable: editingAccount?.sourceTable || 'Local',
    };
    const updated = await saveAccount(account);
    setData(updated);
    setModalVisible(false);
  };

  const handleSnapshot = async () => {
    if (!data) return;
    const totalAssets = data.accounts.reduce((sum, a) => sum + a.balance, 0);
    const balances: Record<string, number> = {};
    data.accounts.forEach((a) => {
      balances[a.id] = a.balance;
    });
    const snapshot = {
      id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      totalAssets,
      totalLiabilities: 0,
      netWorth: totalAssets,
      accountBalances: balances,
    };
    const updated = await saveSnapshot(snapshot);
    setData(updated);
    const msg = 'Snapshot saved! Your net worth trend has been updated.';
    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Snapshot Saved', msg);
  };

  if (!data) return null;

  const totalBalance = data.accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={styles.contentInner}>
        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Balance</Text>
          <Text style={styles.totalAmount}>{formatCurrencyDecimal(totalBalance)}</Text>
          <Text style={styles.accountCount}>
            {data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Snapshot Button */}
        <TouchableOpacity style={styles.snapshotBtn} onPress={handleSnapshot}>
          <Feather name="camera" size={16} color={Colors.accent} />
          <Text style={styles.snapshotBtnText}>Save Snapshot</Text>
        </TouchableOpacity>

        {/* Filters */}
        <FilterChips
          options={['All', 'Excl. Non-Cash', ...Array.from(new Set(data.accounts.map(a => a.sourceTable)))]}
          selected={sourceFilter}
          onSelect={setSourceFilter}
        />
        <FilterChips
          options={['All', ...Array.from(new Set(
            (sourceFilter === 'All'
              ? data.accounts
              : sourceFilter === 'Excl. Non-Cash'
              ? data.accounts.filter(a => a.sourceTable !== 'Non-Cash Assets')
              : data.accounts.filter(a => a.sourceTable === sourceFilter)
            ).map(a => accountTypeLabel(a.type))
          ))]}
          selected={typeFilter}
          onSelect={setTypeFilter}
        />

        {/* Account Tiles */}
        {data.accounts
          .filter(a => {
            if (sourceFilter === 'Excl. Non-Cash' && a.sourceTable === 'Non-Cash Assets') return false;
            if (sourceFilter !== 'All' && sourceFilter !== 'Excl. Non-Cash' && a.sourceTable !== sourceFilter) return false;
            if (typeFilter !== 'All' && accountTypeLabel(a.type) !== typeFilter) return false;
            return true;
          })
          .map((account) => (
          <TouchableOpacity
            key={account.id}
            style={styles.accountTile}
            activeOpacity={0.6}
            onPress={() => navigation.navigate('AccountDetail', { accountId: account.id, accountName: account.name })}
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
              <View style={{ flex: 1 }}>
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
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Feather name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingAccount ? 'Edit Account' : 'Add Account'}</Text>

            <InputField label="Account Name" value={name} onChangeText={setName} placeholder="e.g. Chase Checking" />
            <InputField
              label="Balance"
              value={balance}
              onChangeText={setBalance}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <InputField
              label="Institution"
              value={institution}
              onChangeText={setInstitution}
              placeholder="e.g. Chase, Fidelity"
            />

            <Text style={styles.typeLabel}>Account Type</Text>
            <TouchableOpacity style={styles.typePicker} onPress={() => setShowTypePicker(!showTypePicker)}>
              <Text style={styles.typePickerText}>{accountTypeLabel(type)}</Text>
              <Text style={styles.typePickerArrow}>{showTypePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showTypePicker && (
              <ScrollView style={styles.typeList} nestedScrollEnabled>
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeItem, type === t.value && styles.typeItemActive]}
                    onPress={() => {
                      setType(t.value);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text style={[styles.typeItemText, type === t.value && styles.typeItemTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
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
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  contentInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  totalSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  totalLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  totalAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.hero,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  accountCount: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  snapshotBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.accentDim,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  snapshotBtnText: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
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
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
  typePickerArrow: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
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
