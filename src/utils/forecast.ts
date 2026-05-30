import { RetirementScenario, ForecastScenario } from '../types';

export interface ForecastPoint {
  year: number;
  age?: number;
  value: number;
  nominalValue?: number;
}

export function calculateRetirementForecast(scenario: RetirementScenario): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const yearsToRetirement = scenario.retirementAge - scenario.currentAge;
  let balance = scenario.currentSavings;
  let realBalance = scenario.currentSavings;
  const monthlyRate = scenario.annualReturnRate / 12;
  const monthlyInflation = scenario.inflationRate / 12;
  const realMonthlyRate = monthlyRate - monthlyInflation;

  for (let year = 0; year <= yearsToRetirement; year++) {
    points.push({
      year,
      age: scenario.currentAge + year,
      value: Math.round(realBalance),
      nominalValue: Math.round(balance),
    });
    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + scenario.monthlyContribution;
      realBalance = realBalance * (1 + realMonthlyRate) + scenario.monthlyContribution;
    }
  }
  return points;
}

export function calculateRetirementIncome(scenario: RetirementScenario): {
  projectedBalance: number;
  projectedBalanceNominal: number;
  annualWithdrawal: number;
  monthlyWithdrawal: number;
  yearsOfIncome: number;
  totalContributed: number;
  investmentGrowth: number;
} {
  const forecast = calculateRetirementForecast(scenario);
  const lastPoint = forecast[forecast.length - 1];
  const projectedBalance = lastPoint?.value ?? 0;
  const projectedBalanceNominal = lastPoint?.nominalValue ?? 0;
  const safeWithdrawalRate = 0.04;
  const annualWithdrawal = projectedBalance * safeWithdrawalRate;
  const monthlyWithdrawal = annualWithdrawal / 12;

  // Simulate drawdown: how many years can we sustain desiredAnnualIncome
  // while still earning returns (minus inflation) on remaining balance
  const realReturnRate = scenario.annualReturnRate - scenario.inflationRate;
  let drawdownBalance = projectedBalance;
  let years = 0;
  const maxYears = 80;
  while (drawdownBalance > 0 && years < maxYears) {
    drawdownBalance = drawdownBalance * (1 + realReturnRate) - scenario.desiredAnnualIncome;
    if (drawdownBalance < 0) break;
    years++;
  }

  const yearsToRetirement = scenario.retirementAge - scenario.currentAge;
  const totalContributed = scenario.currentSavings + scenario.monthlyContribution * 12 * yearsToRetirement;
  const investmentGrowth = projectedBalance - totalContributed;

  return {
    projectedBalance,
    projectedBalanceNominal,
    annualWithdrawal,
    monthlyWithdrawal,
    yearsOfIncome: years,
    totalContributed,
    investmentGrowth,
  };
}

export function calculateNetWorthForecast(scenario: ForecastScenario): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  let balance = scenario.startingNetWorth;
  const monthlyRate = scenario.annualReturnRate / 12;

  for (let year = 0; year <= scenario.years; year++) {
    points.push({
      year,
      value: Math.round(balance),
    });
    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + scenario.monthlySavings;
    }
  }
  return points;
}

export function calculateFIRENumber(annualExpenses: number, safeWithdrawalRate: number = 0.04): number {
  return annualExpenses / safeWithdrawalRate;
}

export function calculateSavingsRate(monthlyIncome: number, monthlyExpenses: number): number {
  if (monthlyIncome <= 0) return 0;
  return Math.max(0, (monthlyIncome - monthlyExpenses) / monthlyIncome);
}
