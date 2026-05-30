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
import SliderInput from '../components/SliderInput';

type Tab = 'retirement' | 'networth';

const fmtDollar = (v: number) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
};
const fmtPct = (v: number) => `${v}%`;
const fmtAge = (v: number) => `${v}`;

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
          <ScrollView style={styles.modalScroll} bounces={false}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setRetModalVisible(false)}>
                  <Text style={styles.modalHeaderCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {editingRet ? 'Edit' : 'New'} Retirement Plan
                </Text>
                <TouchableOpacity onPress={handleRetSave}>
                  <Text style={styles.modalHeaderSave}>Save</Text>
                </TouchableOpacity>
              </View>

              <InputField label="Scenario Name" value={retName} onChangeText={setRetName} placeholder="e.g. Base Plan" />

              {/* Live Chart */}
              {(() => {
                const retScenario: RetirementScenario = {
                  id: 'preview', name: 'Preview',
                  currentAge: parseInt(retAge) || 30,
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
                const retChartData = retForecast.map(p => ({ label: `Age ${p.age}`, value: p.value }));
                const chartW = Math.min(screenWidth - 64, 800);
                return (
                  <>
                    {retChartData.length >= 2 && (
                      <View style={styles.liveChartSection}>
                        <LargeChart data={retChartData} width={chartW} height={180} color={Colors.accent} title="PROJECTED GROWTH" />
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
                <SliderInput label="Current Age" value={parseInt(retAge) || 30} min={18} max={70} step={1} formatValue={fmtAge} onValueChange={v => setRetAge(v.toString())} />
                <SliderInput label="Retirement Age" value={parseInt(retRetireAge) || 60} min={40} max={85} step={1} formatValue={fmtAge} onValueChange={v => setRetRetireAge(v.toString())} />
              </View>

              <View style={styles.sliderSection}>
                <Text style={styles.sliderSectionTitle}>SAVINGS</Text>
                <SliderInput label="Current Savings" value={parseFloat(retSavings) || 0} min={0} max={2000000} step={5000} formatValue={fmtDollar} textValue={retSavings} onTextChange={setRetSavings} onValueChange={v => setRetSavings(v.toFixed(0))} suffix="" />
                <SliderInput label="Monthly Contribution" value={parseFloat(retMonthly) || 0} min={0} max={20000} step={100} formatValue={fmtDollar} textValue={retMonthly} onTextChange={setRetMonthly} onValueChange={v => setRetMonthly(v.toFixed(0))} suffix="/mo" />
              </View>

              <View style={styles.sliderSection}>
                <Text style={styles.sliderSectionTitle}>ASSUMPTIONS</Text>
                <SliderInput label="Annual Return" value={isNaN(parseFloat(retReturn)) ? 7 : parseFloat(retReturn)} min={0} max={15} step={0.5} formatValue={fmtPct} onValueChange={v => setRetReturn(v.toString())} />
                <SliderInput label="Inflation Rate" value={isNaN(parseFloat(retInflation)) ? 3 : parseFloat(retInflation)} min={0} max={10} step={0.5} formatValue={fmtPct} onValueChange={v => setRetInflation(v.toString())} />
                <SliderInput label="Desired Annual Income" value={parseFloat(retIncome) || 80000} min={20000} max={500000} step={5000} formatValue={fmtDollar} textValue={retIncome} onTextChange={setRetIncome} onValueChange={v => setRetIncome(v.toFixed(0))} suffix="" />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Net Worth Forecast Modal */}
      <Modal visible={nwModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} bounces={false}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setNwModalVisible(false)}>
                  <Text style={styles.modalHeaderCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {editingNw ? 'Edit' : 'New'} Net Worth Forecast
                </Text>
                <TouchableOpacity onPress={handleNwSave}>
                  <Text style={styles.modalHeaderSave}>Save</Text>
                </TouchableOpacity>
              </View>

              <InputField label="Scenario Name" value={nwName} onChangeText={setNwName} placeholder="e.g. Moderate Growth" />

              {/* Live Chart */}
              {(() => {
                const nwScenario: ForecastScenario = {
                  id: 'preview', name: 'Preview',
                  startingNetWorth: parseFloat(nwStarting) || 0,
                  monthlySavings: parseFloat(nwMonthly) || 0,
                  annualReturnRate: (isNaN(parseFloat(nwReturn)) ? 7 : parseFloat(nwReturn)) / 100,
                  years: parseInt(nwYears) || 10,
                };
                const nwForecast = nwScenario.years > 0 ? calculateNetWorthForecast(nwScenario) : [];
                const nwChartData = nwForecast.map(p => ({ label: `Yr ${p.year}`, value: p.value }));
                const nwFinalValue = nwForecast[nwForecast.length - 1]?.value ?? 0;
                const nwTotalGain = nwFinalValue - nwScenario.startingNetWorth;
                const chartW = Math.min(screenWidth - 64, 800);
                return (
                  <>
                    {nwChartData.length >= 2 && (
                      <View style={styles.liveChartSection}>
                        <LargeChart data={nwChartData} width={chartW} height={180} color="#4A90D9" title="NET WORTH PROJECTION" />
                        <View style={styles.liveStatsRow}>
                          <View style={styles.liveStat}>
                            <Text style={[styles.liveStatValue, { color: Colors.accent }]}>{formatCurrency(nwFinalValue)}</Text>
                            <Text style={styles.liveStatLabel}>Final Value</Text>
                          </View>
                          <View style={styles.liveStat}>
                            <Text style={[styles.liveStatValue, { color: Colors.positive }]}>+{formatCurrency(nwTotalGain)}</Text>
                            <Text style={styles.liveStatLabel}>Total Gain</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                );
              })()}

              <View style={styles.sliderSection}>
                <Text style={styles.sliderSectionTitle}>STARTING POINT</Text>
                <SliderInput label="Starting Net Worth" value={parseFloat(nwStarting) || 0} min={0} max={2000000} step={5000} formatValue={fmtDollar} textValue={nwStarting} onTextChange={setNwStarting} onValueChange={v => setNwStarting(v.toFixed(0))} suffix="" />
              </View>

              <View style={styles.sliderSection}>
                <Text style={styles.sliderSectionTitle}>GROWTH</Text>
                <SliderInput label="Monthly Savings" value={parseFloat(nwMonthly) || 0} min={0} max={20000} step={100} formatValue={fmtDollar} textValue={nwMonthly} onTextChange={setNwMonthly} onValueChange={v => setNwMonthly(v.toFixed(0))} suffix="/mo" />
                <SliderInput label="Annual Return" value={isNaN(parseFloat(nwReturn)) ? 7 : parseFloat(nwReturn)} min={0} max={15} step={0.5} formatValue={fmtPct} onValueChange={v => setNwReturn(v.toString())} />
                <SliderInput label="Forecast Years" value={parseInt(nwYears) || 10} min={1} max={50} step={1} formatValue={fmtAge} onValueChange={v => setNwYears(v.toString())} />
              </View>
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
  modalHeaderCancel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  modalHeaderSave: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  liveChartSection: {
    marginVertical: Spacing.md,
    backgroundColor: Colors.tileBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
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
});
