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
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius, useTheme } from '../theme';
import { RetirementScenario, AppData } from '../types';
import {
  loadAppData,
  saveRetirementScenario,
  deleteRetirementScenario,
} from '../storage';
import { formatCurrency, formatCurrencyDecimal, accountTypeLabel, yearFromAge } from '../utils/format';
import {
  calculateRetirementForecast,
  calculateRetirementIncome,
} from '../utils/forecast';
import Card from '../components/Card';
import LargeChart from '../components/LargeChart';
import InputField from '../components/InputField';
import SliderInput from '../components/SliderInput';

const fmtDollar = (v: number) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
};
const fmtPct = (v: number) => `${v}%`;
const fmtAge = (v: number) => `${v}`;

export default function ForecastScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const [data, setData] = useState<AppData | null>(null);
  const [retModalVisible, setRetModalVisible] = useState(false);
  const [editingRet, setEditingRet] = useState<RetirementScenario | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);

  // Retirement form state
  const [retName, setRetName] = useState('');
  const [retAge, setRetAge] = useState('');
  const [retRetireAge, setRetRetireAge] = useState('');
  const [retSavings, setRetSavings] = useState('');
  const [retMonthly, setRetMonthly] = useState('');
  const [retReturn, setRetReturn] = useState('');
  const [retInflation, setRetInflation] = useState('');
  const [retIncome, setRetIncome] = useState('');
  const [retLinkedAccountIds, setRetLinkedAccountIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const appData = await loadAppData();
    setData(appData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // --- Retirement ---
  const portfolioTotal = data
    ? data.accounts.reduce((s, a) => s + a.balance, 0)
    : 0;

  const linkedSavingsTotal = data && retLinkedAccountIds.length > 0
    ? data.accounts.filter(a => retLinkedAccountIds.includes(a.id)).reduce((s, a) => s + a.balance, 0)
    : portfolioTotal;

  const toggleRetAccount = (accountId: string) => {
    setRetLinkedAccountIds(prev => {
      const next = prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId];
      const total = data ? data.accounts.filter(a => next.includes(a.id)).reduce((s, a) => s + a.balance, 0) : 0;
      setRetSavings(total.toFixed(0));
      return next;
    });
  };

  const openRetAdd = () => {
    setEditingRet(null);
    setRetName('');
    setRetAge('27');
    setRetRetireAge('60');
    setRetSavings(portfolioTotal.toFixed(0));
    setRetMonthly('2000');
    setRetReturn('7');
    setRetInflation('3');
    setRetIncome('80000');
    setRetLinkedAccountIds([]);
    setAccountPickerOpen(false);
    setRetModalVisible(true);
  };

  const openRetEdit = (s: RetirementScenario) => {
    setEditingRet(s);
    setRetName(s.name);
    setRetAge(s.currentAge.toString());
    setRetRetireAge(s.retirementAge.toString());
    setRetSavings(s.currentSavings.toString());
    setRetMonthly(s.monthlyContribution.toString());
    setRetReturn((s.annualReturnRate * 100).toString());
    setRetInflation((s.inflationRate * 100).toString());
    setRetIncome(s.desiredAnnualIncome.toString());
    setRetLinkedAccountIds([]);
    setAccountPickerOpen(false);
    setRetModalVisible(true);
  };

  const handleRetSave = async () => {
    const scenario: RetirementScenario = {
      id: editingRet?.id || uuidv4(),
      name: retName.trim() || 'Retirement Plan',
      currentAge: parseInt(retAge) || 30,
      retirementAge: parseInt(retRetireAge) || 60,
      currentSavings: parseFloat(retSavings) || 0,
      monthlyContribution: parseFloat(retMonthly) || 0,
      annualReturnRate: (isNaN(parseFloat(retReturn)) ? 7 : parseFloat(retReturn)) / 100,
      inflationRate: (isNaN(parseFloat(retInflation)) ? 3 : parseFloat(retInflation)) / 100,
      desiredAnnualIncome: parseFloat(retIncome) || 80000,
    };
    const updated = await saveRetirementScenario(scenario);
    setData(updated);
    setRetModalVisible(false);
  };

  const handleRetDelete = async (id: string) => {
    const doDelete = async () => {
      const updated = await deleteRetirementScenario(id);
      setData(updated);
    };
    if (Platform.OS === 'web') {
      if (confirm('Delete this scenario?')) await doDelete();
    } else {
      Alert.alert('Delete Scenario', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  if (!data) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={styles.contentInner}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Retirement Planning</Text>

          {data.retirementScenarios.map((scenario) => {
            const forecast = calculateRetirementForecast(scenario);
            const income = calculateRetirementIncome(scenario);
            const chartData = forecast.map((p) => ({
              label: `Age ${p.age ?? 0} · ${yearFromAge(p.age ?? 0)}`,
              value: p.value,
            }));

            return (
              <View key={scenario.id}>
                <Card>
                  <TouchableOpacity onPress={() => openRetEdit(scenario)}>
                    <Text style={styles.scenarioName}>{scenario.name}</Text>
                    <Text style={styles.scenarioDetail}>
                      Age {scenario.currentAge} ({yearFromAge(scenario.currentAge)}) → {scenario.retirementAge} ({yearFromAge(scenario.retirementAge)}) | {formatCurrency(scenario.monthlyContribution)}/mo | {(scenario.annualReturnRate * 100).toFixed(0)}% return
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteLink} onPress={() => handleRetDelete(scenario.id)}>
                    <Text style={styles.deleteLinkText}>Delete</Text>
                  </TouchableOpacity>
                </Card>

                <Card>
                  <LargeChart
                    data={chartData}
                    width={Math.min(screenWidth - 80, 880)}
                    height={200}
                    color={Colors.accent}
                    title="PROJECTED GROWTH (TODAY'S DOLLARS)"
                  />
                </Card>

                <Card>
                  <Text style={styles.sectionTitle}>PROJECTED AT RETIREMENT</Text>
                  <View style={styles.statGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Portfolio (today's $)</Text>
                      <Text style={styles.statValue}>{formatCurrency(income.projectedBalance)}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Portfolio (nominal)</Text>
                      <Text style={styles.statValue}>{formatCurrency(income.projectedBalanceNominal)}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Annual (4% Rule)</Text>
                      <Text style={styles.statValue}>{formatCurrency(income.annualWithdrawal)}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Monthly Income</Text>
                      <Text style={styles.statValue}>{formatCurrency(income.monthlyWithdrawal)}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Years of Income</Text>
                      <Text style={styles.statValue}>{income.yearsOfIncome >= 80 ? '80+' : income.yearsOfIncome.toString()}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Total Contributed</Text>
                      <Text style={styles.statValue}>{formatCurrency(income.totalContributed)}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Investment Growth</Text>
                      <Text style={[styles.statValue, { color: Colors.positive }]}>+{formatCurrency(income.investmentGrowth)}</Text>
                    </View>
                  </View>
                </Card>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addBtn} onPress={openRetAdd}>
            <Text style={styles.addBtnText}>+ Add Retirement Scenario</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Retirement Modal */}
      <Modal visible={retModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            {/* Sticky Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setRetModalVisible(false)} style={styles.modalHeaderBtn}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingRet ? 'Edit' : 'New'} Retirement Plan
              </Text>
              <TouchableOpacity onPress={handleRetSave} style={styles.modalHeaderBtn}>
                <Text style={[styles.modalHeaderSave, { color: colors.accent }]}>Save</Text>
              </TouchableOpacity>
            </View>
            {/* Scrollable Content */}
            <ScrollView style={styles.modalScroll} bounces={false}>

              <InputField label="Scenario Name" value={retName} onChangeText={setRetName} placeholder="e.g. Base Plan" />

              {/* Live Chart */}
              {(() => {
                const retScenario: RetirementScenario = {
                  id: 'preview', name: 'Preview',
                  currentAge: parseInt(retAge) || 27,
                  retirementAge: parseInt(retRetireAge) || 60,
                  currentSavings: parseFloat(retSavings) || 0,
                  monthlyContribution: parseFloat(retMonthly) || 0,
                  annualReturnRate: (isNaN(parseFloat(retReturn)) ? 7 : parseFloat(retReturn)) / 100,
                  inflationRate: (isNaN(parseFloat(retInflation)) ? 3 : parseFloat(retInflation)) / 100,
                  desiredAnnualIncome: parseFloat(retIncome) || 80000,
                };
                const validRet = retScenario.retirementAge > retScenario.currentAge;
                const retForecast = validRet ? calculateRetirementForecast(retScenario) : [];
                const retIncomeForecast = validRet ? calculateRetirementIncome(retScenario) : null;
                const retChartData = retForecast.map(p => ({ label: `Age ${p.age ?? 0} · ${yearFromAge(p.age ?? 0)}`, value: p.value }));
                const chartW = Math.min(screenWidth - 64, 800);
                const yearsToRetire = retScenario.retirementAge - retScenario.currentAge;
                return (
                  <>
                    {retChartData.length >= 2 && (
                      <View style={styles.liveChartSection}>
                        <Text style={styles.liveChartStarting}>Starting: {formatCurrency(retScenario.currentSavings)} · {yearsToRetire} years to retire</Text>
                        <LargeChart data={retChartData} width={chartW} height={180} color={Colors.accent} title="PROJECTED GROWTH (TODAY'S DOLLARS)" />
                        {retIncomeForecast && (
                          <View style={styles.liveStatsRow}>
                            <View style={styles.liveStat}>
                              <Text style={styles.liveStatValue}>{formatCurrency(retIncomeForecast.projectedBalance)}</Text>
                              <Text style={styles.liveStatLabel}>At Retirement</Text>
                            </View>
                            <View style={styles.liveStat}>
                              <Text style={[styles.liveStatValue, { color: Colors.accent }]}>{formatCurrency(retIncomeForecast.monthlyWithdrawal)}</Text>
                              <Text style={styles.liveStatLabel}>Monthly (4%)</Text>
                            </View>
                            <View style={styles.liveStat}>
                              <Text style={styles.liveStatValue}>{retIncomeForecast.yearsOfIncome >= 80 ? '80+' : retIncomeForecast.yearsOfIncome.toString()}</Text>
                              <Text style={styles.liveStatLabel}>Years of Income</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                );
              })()}

              <View style={styles.sliderSection}>
                <Text style={styles.sliderSectionTitle}>AGE</Text>
                <SliderInput label={`Current Age (${yearFromAge(parseInt(retAge) || 27)})`} value={parseInt(retAge) || 27} min={18} max={70} step={1} formatValue={fmtAge} onValueChange={v => setRetAge(v.toString())} />
                <SliderInput label={`Retirement Age (${yearFromAge(parseInt(retRetireAge) || 60)})`} value={parseInt(retRetireAge) || 60} min={40} max={85} step={1} formatValue={fmtAge} onValueChange={v => setRetRetireAge(v.toString())} />
              </View>

              {/* Account Picker — collapsible */}
              <View style={styles.sliderSection}>
                <TouchableOpacity
                  style={styles.accountPickerToggle}
                  onPress={() => setAccountPickerOpen(!accountPickerOpen)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sliderSectionTitle, { marginBottom: 2 }]}>INCLUDE ACCOUNTS</Text>
                    <Text style={styles.accountPickerHint}>
                      {retLinkedAccountIds.length === 0
                        ? `All ${data.accounts.length} accounts · ${formatCurrency(data.accounts.reduce((s, a) => s + a.balance, 0))}`
                        : `${retLinkedAccountIds.length} of ${data.accounts.length} · ${formatCurrency(linkedSavingsTotal)}`}
                    </Text>
                  </View>
                  <Feather name={accountPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                {accountPickerOpen && (
                  <View style={styles.accountPickerList}>
                    {data.accounts.map(account => {
                      const isLinked = retLinkedAccountIds.includes(account.id);
                      return (
                        <TouchableOpacity
                          key={account.id}
                          style={[styles.accountPickerItem, isLinked && styles.accountPickerItemActive]}
                          onPress={() => toggleRetAccount(account.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.accountPickerCheck, isLinked && styles.accountPickerCheckActive]}>
                            {isLinked && <Feather name="check" size={10} color="#FFF" />}
                          </View>
                          <Text style={styles.accountPickerName} numberOfLines={1}>{account.name}</Text>
                          <Text style={styles.accountPickerBalance}>{formatCurrencyDecimal(account.balance)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.sliderSection}>
                <Text style={styles.sliderSectionTitle}>CONTRIBUTIONS</Text>
                <SliderInput label="Monthly Contribution" value={parseFloat(retMonthly) || 0} min={0} max={20000} step={100} formatValue={fmtDollar} textValue={retMonthly} onTextChange={setRetMonthly} onValueChange={v => setRetMonthly(v.toFixed(0))} suffix="/mo" />
              </View>

              <View style={styles.sliderSection}>
                <Text style={styles.sliderSectionTitle}>ASSUMPTIONS</Text>
                <SliderInput label="Annual Return" value={isNaN(parseFloat(retReturn)) ? 7 : parseFloat(retReturn)} min={0} max={15} step={0.5} formatValue={fmtPct} onValueChange={v => setRetReturn(v.toString())} />
                <SliderInput label="Inflation Rate" value={isNaN(parseFloat(retInflation)) ? 3 : parseFloat(retInflation)} min={0} max={10} step={0.5} formatValue={fmtPct} onValueChange={v => setRetInflation(v.toString())} />
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
  pageTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  scenarioName: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  scenarioDetail: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  deleteLink: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-end',
  },
  deleteLinkText: {
    color: Colors.negative,
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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statItem: {
    width: '46%',
    marginBottom: Spacing.sm,
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginBottom: Spacing.xs,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
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
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '92%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalScroll: {
    flex: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
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
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  modalHeaderSave: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  liveChartSection: {
    marginVertical: Spacing.md,
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  liveChartStarting: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  liveStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  liveStat: {
    alignItems: 'center',
  },
  liveStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  liveStatLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  sliderSection: {
    marginBottom: Spacing.md,
    paddingTop: Spacing.md,
  },
  sliderSectionTitle: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  accountPickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  accountPickerHint: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
  },
  accountPickerList: {
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginTop: Spacing.sm,
  },
  accountPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  accountPickerItemActive: {
    backgroundColor: Colors.accentDim,
  },
  accountPickerCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
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
    flex: 1,
  },
  accountPickerBalance: {
    color: Colors.textPrimary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
