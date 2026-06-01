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
import { loadAppData, saveAccount, deleteAccount } from '../storage';
import { formatCurrencyDecimal, formatDate, accountTypeLabel } from '../utils/format';
import InputField from '../components/InputField';
import FilterChips from '../components/FilterChips';
import MiniChart from '../components/MiniChart';

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

export default function AccountsScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
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



  if (!data) return null;

  const filteredAccounts = data.accounts.filter(a => {
    if (sourceFilter !== 'All' && a.sourceTable !== sourceFilter) return false;
    if (typeFilters.length > 0 && !typeFilters.includes(accountTypeLabel(a.type))) return false;
    return true;
  });
  const filteredBalance = filteredAccounts.reduce((sum, a) => sum + a.balance, 0);
  const isFiltered = sourceFilter !== 'All' || typeFilters.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={styles.contentInner}>
        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>{isFiltered ? 'Filtered Balance' : 'Total Balance'}</Text>
          <Text style={styles.totalAmount}>{formatCurrencyDecimal(filteredBalance)}</Text>
          <Text style={styles.accountCount}>
            {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
          </Text>
        </View>



        {/* Filters */}
        <FilterChips
          options={['All', ...Array.from(new Set(data.accounts.map(a => a.sourceTable)))]}
          selected={sourceFilter}
          onSelect={setSourceFilter}
        />
        <FilterChips
          multiSelect
          options={['All', ...Array.from(new Set(
            (sourceFilter === 'All'
              ? data.accounts
              : data.accounts.filter(a => a.sourceTable === sourceFilter)
            ).map(a => accountTypeLabel(a.type))
          ))]}
          selectedMulti={typeFilters}
          onSelectMulti={setTypeFilters}
        />

        {/* Account Tiles */}
        {filteredAccounts.map((account) => {
          const history = data.snapshots
            .filter(s => s.accountBalances[account.id] !== undefined)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(s => s.accountBalances[account.id]);
          history.push(account.balance);
          const sparkColor = history.length >= 2 && history[history.length - 1] >= history[0] ? Colors.positive : Colors.negative;
          return (
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
                {history.length >= 2 && (
                  <MiniChart data={history} width={60} height={28} color={sparkColor} showFill={false} />
                )}
                <Text style={[styles.accountTileBalance, account.balance < 0 && { color: Colors.negative }]}>
                  {formatCurrencyDecimal(account.balance)}
                </Text>
                <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
              </View>
            </TouchableOpacity>
          );
        })}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Feather name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} bounces={false} keyboardShouldPersistTaps="handled">
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalHeaderBtn}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingAccount ? 'Edit Account' : 'Add Account'}</Text>
              <TouchableOpacity onPress={handleSave} style={styles.modalHeaderBtn}>
                <Text style={styles.modalHeaderSave}>Save</Text>
              </TouchableOpacity>
            </View>

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

});
