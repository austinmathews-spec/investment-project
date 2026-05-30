import { RetirementScenario, ForecastScenario } from '../types';

export interface ForecastPoint {
  year: number;
  age?: number;
  value: number;
}

export function calculateRetirementForecast(scenario: RetirementScenario): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const yearsToRetirement = scenario.retirementAge - scenario.currentAge;
  let balance = scenario.currentSavings;
  const monthlyRate = scenario.annualReturnRate / 12;

  for (let year = 0; year <= yearsToRetirement; year++) {
    points.push({
      year,
      age: scenario.currentAge + year,
      value: Math.round(balance),
    });
    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + scenario.monthlyContribution;
    }
  }
  return points;
}

export function calculateRetirementIncome(scenario: RetirementScenario): {
  projectedBalance: number;
  annualWithdrawal: number;
  monthlyWithdrawal: number;
  yearsOfIncome: number;
} {
  const forecast = calculateRetirementForecast(scenario);
  const projectedBalance = forecast[forecast.length - 1]?.value ?? 0;
  const safeWithdrawalRate = 0.04;
  const annualWithdrawal = projectedBalance * safeWithdrawalRate;
  const monthlyWithdrawal = annualWithdrawal / 12;
  const yearsOfIncome = projectedBalance > 0 ? projectedBalance / scenario.desiredAnnualIncome : 0;

  return {
    projectedBalance,
    annualWithdrawal,
    monthlyWithdrawal,
    yearsOfIncome,
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
