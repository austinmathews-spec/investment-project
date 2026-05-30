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
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { Account, AccountType, AppData } from '../types';
import { loadAppData, saveAccount, deleteAccount, saveSnapshot } from '../storage';
import { formatCurrencyDecimal, accountTypeLabel } from '../utils/format';
import Card from '../components/Card';
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

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setName(account.name);
    setType(account.type);
    setBalance(account.balance.toString());
    setInstitution(account.institution);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !balance.trim()) {
      Alert.alert('Error', 'Name and balance are required');
      return;
    }
    const account: Account = {
      id: editingAccount?.id || uuidv4(),
      name: name.trim(),
      type,
      balance: parseFloat(balance) || 0,
      institution: institution.trim(),
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    const updated = await saveAccount(account);
    setData(updated);
    setModalVisible(false);
  };

  const handleDelete = async (accountId: string) => {
    if (Platform.OS === 'web') {
      if (confirm('Delete this account?')) {
        const updated = await deleteAccount(accountId);
        setData(updated);
      }
    } else {
      Alert.alert('Delete Account', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = await deleteAccount(accountId);
            setData(updated);
          },
        },
      ]);
    }
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
    if (Platform.OS === 'web') {
      alert('Snapshot saved! Your net worth trend has been updated.');
    } else {
      Alert.alert('Snapshot Saved', 'Your net worth trend has been updated.');
    }
  };

  if (!data) return null;

  const totalBalance = data.accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Across All Accounts</Text>
          <Text style={styles.totalAmount}>{formatCurrencyDecimal(totalBalance)}</Text>
          <Text style={styles.accountCount}>{data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Snapshot Button */}
        <TouchableOpacity style={styles.snapshotBtn} onPress={handleSnapshot}>
          <Text style={styles.snapshotBtnText}>Save Snapshot</Text>
          <Text style={styles.snapshotSubtext}>Record current balances to track trends</Text>
        </TouchableOpacity>

        {/* Account Cards */}
        {data.accounts.map((account) => (
          <Card key={account.id}>
            <TouchableOpacity onPress={() => openEdit(account)}>
              <View style={styles.accountHeader}>
                <View>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountMeta}>
                    {accountTypeLabel(account.type)} {account.institution ? `- ${account.institution}` : ''}
                  </Text>
                </View>
                <Text style={styles.accountBalance}>{formatCurrencyDecimal(account.balance)}</Text>
              </View>
              <Text style={styles.lastUpdated}>Updated {account.lastUpdated}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(account.id)}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </Card>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>+</Text>
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

            {/* Type Picker */}
            <Text style={styles.typeLabel}>Account Type</Text>
            <TouchableOpacity style={styles.typePicker} onPress={() => setShowTypePicker(!showTypePicker)}>
              <Text style={styles.typePickerText}>{accountTypeLabel(type)}</Text>
              <Text style={styles.typePickerArrow}>{showTypePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showTypePicker && (
              <View style={styles.typeList}>
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeItem, type === t.value && styles.typeItemActive]}
                    onPress={() => {
                      setType(t.value);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text
                      style={[styles.typeItemText, type === t.value && styles.typeItemTextActive]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
  totalSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  totalLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  totalAmount: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  accountCount: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  snapshotBtn: {
    backgroundColor: Colors.accentDim,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  snapshotBtnText: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  snapshotSubtext: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  accountName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  accountMeta: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  accountBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  lastUpdated: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.sm,
  },
  deleteBtn: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-end',
  },
  deleteBtnText: {
    color: Colors.negative,
    fontSize: FontSizes.sm,
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
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    color: Colors.background,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30,
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
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
});
