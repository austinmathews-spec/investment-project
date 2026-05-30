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
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { RetirementScenario, ForecastScenario, AppData } from '../types';
import {
  loadAppData,
  saveRetirementScenario,
  deleteRetirementScenario,
  saveForecastScenario,
  deleteForecastScenario,
} from '../storage';
import { formatCurrency } from '../utils/format';
import {
  calculateRetirementForecast,
  calculateRetirementIncome,
  calculateNetWorthForecast,
} from '../utils/forecast';
import Card from '../components/Card';
import LargeChart from '../components/LargeChart';
import InputField from '../components/InputField';
import FilterChips from '../components/FilterChips';

type Tab = 'retirement' | 'networth';

function RetirementPreview({ age, retireAge, savings, monthly, returnRate, inflation, income, screenWidth }: {
  age: string; retireAge: string; savings: string; monthly: string;
  returnRate: string; inflation: string; income: string; screenWidth: number;
}) {
  const preview = useMemo(() => {
    const scenario: RetirementScenario = {
      id: 'preview',
      name: 'Preview',
      currentAge: parseInt(age) || 30,
      retirementAge: parseInt(retireAge) || 60,
      currentSavings: parseFloat(savings) || 0,
      monthlyContribution: parseFloat(monthly) || 0,
      annualReturnRate: (isNaN(parseFloat(returnRate)) ? 7 : parseFloat(returnRate)) / 100,
      inflationRate: (isNaN(parseFloat(inflation)) ? 3 : parseFloat(inflation)) / 100,
      desiredAnnualIncome: parseFloat(income) || 80000,
    };
    if (scenario.retirementAge <= scenario.currentAge) return null;
    const forecast = calculateRetirementForecast(scenario);
    const incomeResult = calculateRetirementIncome(scenario);
    const chartData = forecast.map(p => ({ label: `Age ${p.age}`, value: p.value }));
    return { chartData, incomeResult };
  }, [age, retireAge, savings, monthly, returnRate, inflation, income]);

  if (!preview || preview.chartData.length < 2) return null;
  const chartWidth = Math.min(screenWidth - 80, 700);

  return (
    <View style={previewStyles.container}>
      <Text style={previewStyles.title}>LIVE PREVIEW</Text>
      <LargeChart data={preview.chartData} width={chartWidth} height={160} color={Colors.accent} />
      <View style={previewStyles.statsRow}>
        <View style={previewStyles.stat}>
          <Text style={previewStyles.statLabel}>At Retirement</Text>
          <Text style={previewStyles.statValue}>{formatCurrency(preview.incomeResult.projectedBalance)}</Text>
        </View>
        <View style={previewStyles.stat}>
          <Text style={previewStyles.statLabel}>Monthly (4%)</Text>
          <Text style={previewStyles.statValue}>{formatCurrency(preview.incomeResult.monthlyWithdrawal)}</Text>
        </View>
        <View style={previewStyles.stat}>
          <Text style={previewStyles.statLabel}>Years of Income</Text>
          <Text style={previewStyles.statValue}>{preview.incomeResult.yearsOfIncome >= 80 ? '80+' : preview.incomeResult.yearsOfIncome.toString()}</Text>
        </View>
      </View>
    </View>
  );
}

function NetWorthPreview({ starting, monthly, returnRate, years, screenWidth }: {
  starting: string; monthly: string; returnRate: string; years: string; screenWidth: number;
}) {
  const preview = useMemo(() => {
    const scenario: ForecastScenario = {
      id: 'preview',
      name: 'Preview',
      startingNetWorth: parseFloat(starting) || 0,
      monthlySavings: parseFloat(monthly) || 0,
      annualReturnRate: (isNaN(parseFloat(returnRate)) ? 7 : parseFloat(returnRate)) / 100,
      years: parseInt(years) || 10,
    };
    if (scenario.years <= 0) return null;
    const forecast = calculateNetWorthForecast(scenario);
    const finalValue = forecast[forecast.length - 1]?.value ?? 0;
    const totalGain = finalValue - scenario.startingNetWorth;
    const chartData = forecast.map(p => ({ label: `Yr ${p.year}`, value: p.value }));
    return { chartData, finalValue, totalGain };
  }, [starting, monthly, returnRate, years]);

  if (!preview || preview.chartData.length < 2) return null;
  const chartWidth = Math.min(screenWidth - 80, 700);

  return (
    <View style={previewStyles.container}>
      <Text style={previewStyles.title}>LIVE PREVIEW</Text>
      <LargeChart data={preview.chartData} width={chartWidth} height={160} color="#4A90D9" />
      <View style={previewStyles.statsRow}>
        <View style={previewStyles.stat}>
          <Text style={previewStyles.statLabel}>Final Value</Text>
          <Text style={[previewStyles.statValue, { color: Colors.accent }]}>{formatCurrency(preview.finalValue)}</Text>
        </View>
        <View style={previewStyles.stat}>
          <Text style={previewStyles.statLabel}>Total Gain</Text>
          <Text style={[previewStyles.statValue, { color: Colors.positive }]}>+{formatCurrency(preview.totalGain)}</Text>
        </View>
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
  },
  title: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default function ForecastScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [data, setData] = useState<AppData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retirement');
  const [retModalVisible, setRetModalVisible] = useState(false);
  const [nwModalVisible, setNwModalVisible] = useState(false);
  const [editingRet, setEditingRet] = useState<RetirementScenario | null>(null);
  const [editingNw, setEditingNw] = useState<ForecastScenario | null>(null);

  // Retirement form state
  const [retName, setRetName] = useState('');
  const [retAge, setRetAge] = useState('');
  const [retRetireAge, setRetRetireAge] = useState('');
  const [retSavings, setRetSavings] = useState('');
  const [retMonthly, setRetMonthly] = useState('');
  const [retReturn, setRetReturn] = useState('');
  const [retInflation, setRetInflation] = useState('');
  const [retIncome, setRetIncome] = useState('');

  // Net worth forecast form state
  const [nwName, setNwName] = useState('');
  const [nwStarting, setNwStarting] = useState('');
  const [nwMonthly, setNwMonthly] = useState('');
  const [nwReturn, setNwReturn] = useState('');
  const [nwYears, setNwYears] = useState('');

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
  const portfolioExclNonCash = data
    ? data.accounts.filter(a => a.sourceTable !== 'Non-Cash Assets').reduce((s, a) => s + a.balance, 0)
    : 0;

  const openRetAdd = () => {
    setEditingRet(null);
    setRetName('');
    setRetAge('30');
    setRetRetireAge('60');
    setRetSavings(portfolioExclNonCash.toFixed(0));
    setRetMonthly('2000');
    setRetReturn('7');
    setRetInflation('3');
    setRetIncome('80000');
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

  // --- Net Worth Forecast ---
  const openNwAdd = () => {
    setEditingNw(null);
    setNwName('');
    setNwStarting(portfolioExclNonCash.toFixed(0));
    setNwMonthly('3000');
    setNwReturn('7');
    setNwYears('10');
    setNwModalVisible(true);
  };

  const openNwEdit = (s: ForecastScenario) => {
    setEditingNw(s);
    setNwName(s.name);
    setNwStarting(s.startingNetWorth.toString());
    setNwMonthly(s.monthlySavings.toString());
    setNwReturn((s.annualReturnRate * 100).toString());
    setNwYears(s.years.toString());
    setNwModalVisible(true);
  };

  const handleNwSave = async () => {
    const scenario: ForecastScenario = {
      id: editingNw?.id || uuidv4(),
      name: nwName.trim() || 'Net Worth Forecast',
      startingNetWorth: parseFloat(nwStarting) || 0,
      monthlySavings: parseFloat(nwMonthly) || 0,
      annualReturnRate: (isNaN(parseFloat(nwReturn)) ? 7 : parseFloat(nwReturn)) / 100,
      years: parseInt(nwYears) || 10,
    };
    const updated = await saveForecastScenario(scenario);
    setData(updated);
    setNwModalVisible(false);
  };

  const handleNwDelete = async (id: string) => {
    const doDelete = async () => {
      const updated = await deleteForecastScenario(id);
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
    <View style={styles.container}>
      {/* Tab Switcher */}
      <FilterChips
        options={['Retirement', 'Net Worth']}
        selected={activeTab === 'retirement' ? 'Retirement' : 'Net Worth'}
        onSelect={(opt) => setActiveTab(opt === 'Retirement' ? 'retirement' : 'networth')}
      />

      <ScrollView contentContainerStyle={[styles.content, { alignItems: 'center' }]}>
        <View style={styles.contentInner}>
        {activeTab === 'retirement' && (
          <>
            {data.retirementScenarios.map((scenario) => {
              const forecast = calculateRetirementForecast(scenario);
              const income = calculateRetirementIncome(scenario);
              const chartData = forecast.map((p) => ({
                label: `Age ${p.age}`,
                value: p.value,
              }));

              return (
                <View key={scenario.id}>
                  <Card>
                    <TouchableOpacity onPress={() => openRetEdit(scenario)}>
                      <Text style={styles.scenarioName}>{scenario.name}</Text>
                      <Text style={styles.scenarioDetail}>
                        Age {scenario.currentAge} → {scenario.retirementAge} | {formatCurrency(scenario.monthlyContribution)}/mo | {(scenario.annualReturnRate * 100).toFixed(0)}% return
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
          </>
        )}

        {activeTab === 'networth' && (
          <>
            {data.forecastScenarios.map((scenario) => {
              const forecast = calculateNetWorthForecast(scenario);
              const chartData = forecast.map((p) => ({
                label: `Yr ${p.year}`,
                value: p.value,
              }));
              const finalValue = forecast[forecast.length - 1]?.value ?? 0;
              const totalGain = finalValue - scenario.startingNetWorth;

              return (
                <View key={scenario.id}>
                  <Card>
                    <TouchableOpacity onPress={() => openNwEdit(scenario)}>
                      <Text style={styles.scenarioName}>{scenario.name}</Text>
                      <Text style={styles.scenarioDetail}>
                        {formatCurrency(scenario.monthlySavings)}/mo | {(scenario.annualReturnRate * 100).toFixed(0)}% return | {scenario.years} years
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteLink} onPress={() => handleNwDelete(scenario.id)}>
                      <Text style={styles.deleteLinkText}>Delete</Text>
                    </TouchableOpacity>
                  </Card>

                  <Card>
                    <LargeChart
                      data={chartData}
                      width={Math.min(screenWidth - 80, 880)}
                      height={200}
                      color="#4A90D9"
                      title="NET WORTH PROJECTION"
                    />
                  </Card>

                  <Card>
                    <Text style={styles.sectionTitle}>PROJECTED OUTCOME</Text>
                    {(() => {
                      const totalContributed = scenario.startingNetWorth + scenario.monthlySavings * scenario.years * 12;
                      const investmentGrowth = finalValue - totalContributed;
                      return (
                        <View style={styles.statGrid}>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Starting</Text>
                            <Text style={styles.statValue}>{formatCurrency(scenario.startingNetWorth)}</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Final Net Worth</Text>
                            <Text style={[styles.statValue, { color: Colors.accent }]}>{formatCurrency(finalValue)}</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Contributed</Text>
                            <Text style={styles.statValue}>
                              {formatCurrency(scenario.monthlySavings * scenario.years * 12)}
                            </Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Investment Growth</Text>
                            <Text style={[styles.statValue, { color: Colors.positive }]}>+{formatCurrency(investmentGrowth)}</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Gain</Text>
                            <Text style={[styles.statValue, { color: Colors.positive }]}>+{formatCurrency(totalGain)}</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Growth Multiple</Text>
                            <Text style={styles.statValue}>{scenario.startingNetWorth > 0 ? `${(finalValue / scenario.startingNetWorth).toFixed(1)}x` : 'N/A'}</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </Card>
                </View>
              );
            })}

            <TouchableOpacity style={styles.addBtn} onPress={openNwAdd}>
              <Text style={styles.addBtnText}>+ Add Forecast Scenario</Text>
            </TouchableOpacity>
          </>
        )}
        </View>
      </ScrollView>

      {/* Retirement Modal */}
      <Modal visible={retModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingRet ? 'Edit' : 'New'} Retirement Scenario
              </Text>
              <InputField label="Scenario Name" value={retName} onChangeText={setRetName} placeholder="e.g. Base Plan" />
              <InputField label="Current Age" value={retAge} onChangeText={setRetAge} keyboardType="number-pad" />
              <InputField label="Retirement Age" value={retRetireAge} onChangeText={setRetRetireAge} keyboardType="number-pad" />
              <InputField label="Current Savings ($)" value={retSavings} onChangeText={setRetSavings} keyboardType="decimal-pad" />
              <InputField label="Monthly Contribution ($)" value={retMonthly} onChangeText={setRetMonthly} keyboardType="decimal-pad" />
              <InputField label="Expected Annual Return (%)" value={retReturn} onChangeText={setRetReturn} keyboardType="decimal-pad" />
              <InputField label="Inflation Rate (%)" value={retInflation} onChangeText={setRetInflation} keyboardType="decimal-pad" />
              <InputField label="Desired Annual Income ($)" value={retIncome} onChangeText={setRetIncome} keyboardType="decimal-pad" />

              {/* Live Preview Chart */}
              <RetirementPreview
                age={retAge} retireAge={retRetireAge} savings={retSavings}
                monthly={retMonthly} returnRate={retReturn} inflation={retInflation}
                income={retIncome} screenWidth={screenWidth}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setRetModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleRetSave}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Net Worth Forecast Modal */}
      <Modal visible={nwModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingNw ? 'Edit' : 'New'} Net Worth Forecast
            </Text>
            <InputField label="Scenario Name" value={nwName} onChangeText={setNwName} placeholder="e.g. Moderate Growth" />
            <InputField label="Starting Net Worth ($)" value={nwStarting} onChangeText={setNwStarting} keyboardType="decimal-pad" />
            <InputField label="Monthly Savings ($)" value={nwMonthly} onChangeText={setNwMonthly} keyboardType="decimal-pad" />
            <InputField label="Expected Annual Return (%)" value={nwReturn} onChangeText={setNwReturn} keyboardType="decimal-pad" />
            <InputField label="Forecast Years" value={nwYears} onChangeText={setNwYears} keyboardType="number-pad" />

            {/* Live Preview Chart */}
            <NetWorthPreview
              starting={nwStarting} monthly={nwMonthly}
              returnRate={nwReturn} years={nwYears}
              screenWidth={screenWidth}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNwModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleNwSave}>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.accent,
  },
  tabText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.accent,
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
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalScroll: {
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.lg,
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
