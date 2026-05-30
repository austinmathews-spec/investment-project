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
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { Goal, AppData } from '../types';
import { loadAppData, saveGoal, deleteGoal } from '../storage';
import { formatCurrency, formatCurrencyDecimal, accountTypeLabel } from '../utils/format';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import InputField from '../components/InputField';
import FilterChips from '../components/FilterChips';

const GOAL_COLORS = Colors.goalColors;

export default function GoalsScreen() {
  const [data, setData] = useState<AppData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedColor, setSelectedColor] = useState(GOAL_COLORS[0]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [linkedAccountIds, setLinkedAccountIds] = useState<string[]>([]);

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
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
    setTargetDate('2027-12-31');
    setSelectedColor(GOAL_COLORS[(data?.goals.length ?? 0) % GOAL_COLORS.length]);
    setLinkedAccountIds([]);
    setModalVisible(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(goal.targetAmount.toString());
    setCurrentAmount(goal.currentAmount.toString());
    setTargetDate(goal.targetDate);
    setSelectedColor(goal.color);
    setLinkedAccountIds(goal.linkedAccountIds || []);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !targetAmount.trim()) {
      const msg = 'Name and target amount are required';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }
    const goal: Goal = {
      id: editingGoal?.id || uuidv4(),
      name: name.trim(),
      targetAmount: parseFloat(targetAmount) || 0,
      currentAmount: parseFloat(currentAmount) || 0,
      targetDate: targetDate || '2027-12-31',
      color: selectedColor,
      linkedAccountIds: linkedAccountIds.length > 0 ? linkedAccountIds : undefined,
    };
    const updated = await saveGoal(goal);
    setData(updated);
    setModalVisible(false);
  };

  const handleDelete = async (goalId: string) => {
    const doDelete = async () => {
      const updated = await deleteGoal(goalId);
      setData(updated);
    };
    if (Platform.OS === 'web') {
      if (confirm('Delete this goal?')) await doDelete();
    } else {
      Alert.alert('Delete Goal', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  if (!data) return null;

  const getGoalCurrent = (goal: Goal): number => {
    if (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) {
      return data.accounts
        .filter(a => goal.linkedAccountIds!.includes(a.id))
        .reduce((sum, a) => sum + a.balance, 0);
    }
    return goal.currentAmount;
  };

  const totalGoalTarget = data.goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalGoalCurrent = data.goals.reduce((sum, g) => sum + getGoalCurrent(g), 0);
  const overallProgress = totalGoalTarget > 0 ? totalGoalCurrent / totalGoalTarget : 0;

  const toggleAccount = (accountId: string) => {
    setLinkedAccountIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={styles.contentInner}>
        {/* Summary */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Your Goals</Text>
          <Text style={styles.headerSubtext}>
            {formatCurrency(totalGoalCurrent)} of {formatCurrency(totalGoalTarget)} saved
          </Text>
          <View style={styles.overallProgressBar}>
            <ProgressBar progress={overallProgress} color={Colors.accent} height={10} />
          </View>
          <Text style={styles.overallPercent}>{(overallProgress * 100).toFixed(0)}% overall</Text>
        </View>

        {/* Filter */}
        <FilterChips
          options={['All', 'In Progress', 'Completed']}
          selected={statusFilter}
          onSelect={setStatusFilter}
        />

        {/* Goal Cards */}
        {data.goals.filter((goal) => {
          if (statusFilter === 'All') return true;
          const cur = getGoalCurrent(goal);
          const progress = goal.targetAmount > 0 ? cur / goal.targetAmount : 0;
          return statusFilter === 'Completed' ? progress >= 1 : progress < 1;
        }).map((goal) => {
          const goalCurrent = getGoalCurrent(goal);
          const progress = goal.targetAmount > 0 ? goalCurrent / goal.targetAmount : 0;
          const remaining = Math.max(0, goal.targetAmount - goalCurrent);
          const targetDate = new Date(goal.targetDate);
          const linkedAccounts = goal.linkedAccountIds
            ? data.accounts.filter(a => goal.linkedAccountIds!.includes(a.id))
            : [];
          const now = new Date();
          const monthsLeft = Math.max(
            0,
            (targetDate.getFullYear() - now.getFullYear()) * 12 +
              (targetDate.getMonth() - now.getMonth())
          );
          const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;

          return (
            <Card key={goal.id}>
              <TouchableOpacity onPress={() => openEdit(goal)}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalTitleRow}>
                    <View style={[styles.goalDot, { backgroundColor: goal.color }]} />
                    <Text style={styles.goalName}>{goal.name}</Text>
                  </View>
                  <Text style={styles.goalPercent}>{(progress * 100).toFixed(0)}%</Text>
                </View>

                <View style={styles.goalAmounts}>
                  <Text style={styles.goalCurrent}>{formatCurrency(goalCurrent)}</Text>
                  <Text style={styles.goalTarget}> of {formatCurrency(goal.targetAmount)}</Text>
                </View>

                <ProgressBar progress={Math.min(progress, 1)} color={goal.color} height={8} />

                {linkedAccounts.length > 0 && (
                  <View style={styles.linkedAccountsList}>
                    {linkedAccounts.map(a => (
                      <View key={a.id} style={styles.linkedAccountRow}>
                        <Text style={styles.linkedAccountName}>{a.name}</Text>
                        <Text style={styles.linkedAccountBalance}>{formatCurrencyDecimal(a.balance)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.goalFooter}>
                  <Text style={styles.goalFooterText}>
                    {formatCurrency(remaining)} remaining
                  </Text>
                  {monthsLeft > 0 && (
                    <Text style={styles.goalFooterText}>
                      {formatCurrency(monthlyNeeded)}/mo needed
                    </Text>
                  )}
                </View>

                <Text style={styles.goalDate}>
                  Target: {targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  {monthsLeft > 0 ? ` (${monthsLeft} months)` : ' (past due)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteLink} onPress={() => handleDelete(goal.id)}>
                <Text style={styles.deleteLinkText}>Delete</Text>
              </TouchableOpacity>
            </Card>
          );
        })}

        {/* Add Goal Button */}
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add New Goal</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingGoal ? 'Edit Goal' : 'New Goal'}</Text>

            <InputField label="Goal Name" value={name} onChangeText={setName} placeholder="e.g. House Down Payment" />
            <InputField
              label="Target Amount ($)"
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="50000"
              keyboardType="decimal-pad"
            />
            <InputField
              label={linkedAccountIds.length > 0 ? 'Current (auto from accounts)' : 'Current Amount ($)'}
              value={linkedAccountIds.length > 0
                ? formatCurrencyDecimal(data.accounts.filter(a => linkedAccountIds.includes(a.id)).reduce((s, a) => s + a.balance, 0))
                : currentAmount
              }
              onChangeText={linkedAccountIds.length > 0 ? () => {} : setCurrentAmount}
              placeholder="0"
              keyboardType="decimal-pad"
              editable={linkedAccountIds.length === 0}
            />

            {/* Link Accounts */}
            <Text style={styles.colorLabel}>Link Accounts (optional)</Text>
            <Text style={styles.accountPickerHint}>Select accounts to auto-track progress from balances</Text>
            <ScrollView style={styles.accountPickerList} nestedScrollEnabled>
              {data.accounts.map(account => {
                const isLinked = linkedAccountIds.includes(account.id);
                return (
                  <TouchableOpacity
                    key={account.id}
                    style={[styles.accountPickerItem, isLinked && styles.accountPickerItemActive]}
                    onPress={() => toggleAccount(account.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.accountPickerLeft}>
                      <View style={[styles.accountPickerCheck, isLinked && styles.accountPickerCheckActive]}>
                        {isLinked && <Feather name="check" size={12} color="#FFF" />}
                      </View>
                      <View>
                        <Text style={styles.accountPickerName}>{account.name}</Text>
                        <Text style={styles.accountPickerMeta}>
                          {accountTypeLabel(account.type)}{account.institution ? ` · ${account.institution}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.accountPickerBalance}>{formatCurrencyDecimal(account.balance)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <InputField
              label="Target Date (YYYY-MM-DD)"
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="2027-12-31"
            />

            {/* Color Picker */}
            <Text style={styles.colorLabel}>Color</Text>
            <View style={styles.colorRow}>
              {GOAL_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorDotActive,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

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
    paddingBottom: Spacing.xxl,
  },
  contentInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  headerLabel: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  headerSubtext: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  overallProgressBar: {
    width: '100%',
    marginBottom: Spacing.xs,
  },
  overallPercent: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  goalName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  goalPercent: {
    color: Colors.textSecondary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  goalAmounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  goalCurrent: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  goalTarget: {
    color: Colors.textTertiary,
    fontSize: FontSizes.md,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  goalFooterText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  goalDate: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  deleteLink: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-end',
  },
  deleteLinkText: {
    color: Colors.negative,
    fontSize: FontSizes.sm,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addBtnText: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '600',
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
    maxHeight: '90%',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  colorLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
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
  linkedAccountsList: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  linkedAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  linkedAccountName: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
  },
  linkedAccountBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  accountPickerHint: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginBottom: Spacing.sm,
  },
  accountPickerList: {
    maxHeight: 180,
    marginBottom: Spacing.md,
  },
  accountPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
    backgroundColor: Colors.tileBg,
  },
  accountPickerItemActive: {
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  accountPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountPickerCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountPickerCheckActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  accountPickerName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  accountPickerMeta: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
  accountPickerBalance: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
