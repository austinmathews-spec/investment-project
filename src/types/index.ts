export type AccountType =
  | 'checking'
  | 'savings'
  | 'brokerage'
  | 'traditional_ira'
  | 'roth_ira'
  | '401k'
  | 'hsa'
  | '529'
  | 'crypto'
  | 'real_estate'
  | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  institution: string;
  lastUpdated: string; // ISO date
}

export interface NetWorthSnapshot {
  id: string;
  date: string; // ISO date
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accountBalances: Record<string, number>; // accountId -> balance
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // ISO date
  color: string;
}

export interface RetirementScenario {
  id: string;
  name: string;
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  annualReturnRate: number; // as decimal, e.g. 0.07
  inflationRate: number;
  desiredAnnualIncome: number;
}

export interface ForecastScenario {
  id: string;
  name: string;
  startingNetWorth: number;
  monthlySavings: number;
  annualReturnRate: number;
  years: number;
}

export type ExpenseFrequency = 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Semi-Annual' | 'Annual';
export type ExpenseCategory = 'Housing' | 'Lifestyle' | 'Debt' | 'Car' | 'Penny' | 'Food & Grocery';

export interface RecurringExpense {
  id: string;
  airtableId?: string;
  name: string;
  amount: number;
  frequency: ExpenseFrequency;
  category: ExpenseCategory;
  splitWith: string[];
  effectiveAmount: number; // monthly effective cost
}

export interface AirtableConfig {
  pat: string;
  baseId: string;
}

export interface AppData {
  accounts: Account[];
  snapshots: NetWorthSnapshot[];
  goals: Goal[];
  retirementScenarios: RetirementScenario[];
  forecastScenarios: ForecastScenario[];
  expenses: RecurringExpense[];
  airtableConfig?: AirtableConfig;
}
