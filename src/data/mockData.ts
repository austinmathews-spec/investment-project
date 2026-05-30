import { Account, NetWorthSnapshot, Goal, RetirementScenario, ForecastScenario } from '../types';

export const sampleAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Chase Checking',
    type: 'checking',
    balance: 8420.50,
    institution: 'Chase',
    lastUpdated: '2026-05-15',
  },
  {
    id: 'acc-2',
    name: 'Ally Savings',
    type: 'savings',
    balance: 25000.00,
    institution: 'Ally Bank',
    lastUpdated: '2026-05-15',
  },
  {
    id: 'acc-3',
    name: 'Fidelity 401(k)',
    type: '401k',
    balance: 87500.00,
    institution: 'Fidelity',
    lastUpdated: '2026-05-01',
  },
  {
    id: 'acc-4',
    name: 'Vanguard Roth IRA',
    type: 'roth_ira',
    balance: 42300.00,
    institution: 'Vanguard',
    lastUpdated: '2026-05-01',
  },
  {
    id: 'acc-5',
    name: 'Schwab Brokerage',
    type: 'brokerage',
    balance: 31200.00,
    institution: 'Schwab',
    lastUpdated: '2026-04-30',
  },
  {
    id: 'acc-6',
    name: 'Coinbase Crypto',
    type: 'crypto',
    balance: 5800.00,
    institution: 'Coinbase',
    lastUpdated: '2026-05-10',
  },
];

export const sampleSnapshots: NetWorthSnapshot[] = [
  {
    id: 'snap-1',
    date: '2025-06-01',
    totalAssets: 155000,
    totalLiabilities: 0,
    netWorth: 155000,
    accountBalances: {},
  },
  {
    id: 'snap-2',
    date: '2025-09-01',
    totalAssets: 168000,
    totalLiabilities: 0,
    netWorth: 168000,
    accountBalances: {},
  },
  {
    id: 'snap-3',
    date: '2025-12-01',
    totalAssets: 178500,
    totalLiabilities: 0,
    netWorth: 178500,
    accountBalances: {},
  },
  {
    id: 'snap-4',
    date: '2026-03-01',
    totalAssets: 192000,
    totalLiabilities: 0,
    netWorth: 192000,
    accountBalances: {},
  },
  {
    id: 'snap-5',
    date: '2026-05-15',
    totalAssets: 200220.50,
    totalLiabilities: 0,
    netWorth: 200220.50,
    accountBalances: {},
  },
];

export const sampleGoals: Goal[] = [
  {
    id: 'goal-1',
    name: 'House Down Payment',
    targetAmount: 80000,
    currentAmount: 25000,
    targetDate: '2028-06-01',
    color: '#4A90D9',
  },
  {
    id: 'goal-2',
    name: 'Emergency Fund',
    targetAmount: 30000,
    currentAmount: 25000,
    targetDate: '2026-12-01',
    color: '#00D4AA',
  },
  {
    id: 'goal-3',
    name: 'Vacation Fund',
    targetAmount: 5000,
    currentAmount: 1200,
    targetDate: '2027-03-01',
    color: '#FFB84D',
  },
];

export const sampleRetirementScenario: RetirementScenario = {
  id: 'ret-1',
  name: 'Base Plan',
  currentAge: 30,
  retirementAge: 60,
  currentSavings: 129800,
  monthlyContribution: 2500,
  annualReturnRate: 0.07,
  inflationRate: 0.03,
  desiredAnnualIncome: 80000,
};

export const sampleForecastScenario: ForecastScenario = {
  id: 'fc-1',
  name: 'Moderate Growth',
  startingNetWorth: 200220.50,
  monthlySavings: 3000,
  annualReturnRate: 0.07,
  years: 10,
};
