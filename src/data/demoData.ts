import { AppData, Account, NetWorthSnapshot, Goal, RecurringExpense } from '../types';

// ─── Demo accounts (same structure as real, ~$605k net worth) ────

const demoAccounts: Account[] = [
  {
    id: 'savings::Emergency HYS (Marcus)',
    name: 'Emergency HYS',
    type: 'savings',
    balance: 55000,
    institution: 'Marcus',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Cash HYS (Sofi)',
    name: 'Cash HYS',
    type: 'savings',
    balance: 42000,
    institution: 'SoFi',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Cash Checking (Sofi)',
    name: 'Cash Checking',
    type: 'checking',
    balance: 15800,
    institution: 'SoFi',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Debit (Bofa)',
    name: 'Debit',
    type: 'checking',
    balance: 5200,
    institution: 'BofA',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Crypto Strike',
    name: 'Crypto Strike',
    type: 'crypto',
    balance: 35000,
    institution: 'Strike',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Fidelity Crypto',
    name: 'Fidelity Crypto',
    type: 'crypto',
    balance: 52000,
    institution: 'Fidelity',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Airtable 401k',
    name: '401k',
    type: '401k',
    balance: 195000,
    institution: 'Airtable',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Roth IRA',
    name: 'Roth IRA',
    type: 'roth_ira',
    balance: 98500,
    institution: 'Fidelity',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::Rollover IRA',
    name: 'Rollover IRA',
    type: 'traditional_ira',
    balance: 82000,
    institution: 'Fidelity',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
  {
    id: 'savings::HSA',
    name: 'HSA',
    type: 'hsa',
    balance: 24500,
    institution: 'Optum',
    lastUpdated: '2026-05-28',
    sourceTable: 'Savings & Investment',
  },
];

// ─── Demo snapshots (12-month growth from ~$400k to ~$605k) ──────

// Per-account balance history scaled along net-worth growth with a small
// deterministic wiggle so sparklines and the portfolio map have rich data.
function demoBalancesFor(netWorth: number, snapshotIndex: number): Record<string, number> {
  const finalNetWorth = 605000;
  const ratio = netWorth / finalNetWorth;
  const balances: Record<string, number> = {};
  demoAccounts.forEach((account, i) => {
    const wiggle = 1 + Math.sin(snapshotIndex * 1.7 + i * 2.3) * 0.04;
    balances[account.id] = Math.round(account.balance * ratio * wiggle);
  });
  return balances;
}

const demoSnapshotSeed: { id: string; date: string; netWorth: number }[] = [
  { id: 'demo-snap-01', date: '2025-06-01', netWorth: 405000 },
  { id: 'demo-snap-02', date: '2025-07-01', netWorth: 418000 },
  { id: 'demo-snap-03', date: '2025-08-01', netWorth: 432000 },
  { id: 'demo-snap-04', date: '2025-09-01', netWorth: 448000 },
  { id: 'demo-snap-05', date: '2025-10-01', netWorth: 461000 },
  { id: 'demo-snap-06', date: '2025-11-01', netWorth: 472000 },
  { id: 'demo-snap-07', date: '2025-12-01', netWorth: 490000 },
  { id: 'demo-snap-08', date: '2026-01-01', netWorth: 510000 },
  { id: 'demo-snap-09', date: '2026-02-01', netWorth: 535000 },
  { id: 'demo-snap-10', date: '2026-03-01', netWorth: 558000 },
  { id: 'demo-snap-11', date: '2026-04-01', netWorth: 580000 },
  { id: 'demo-snap-12', date: '2026-05-28', netWorth: 605000 },
];

const demoSnapshots: NetWorthSnapshot[] = demoSnapshotSeed.map((s, i) => ({
  id: s.id,
  date: s.date,
  totalAssets: s.netWorth,
  totalLiabilities: 0,
  netWorth: s.netWorth,
  accountBalances: demoBalancesFor(s.netWorth, i),
}));

// ─── Demo goals ──────────────────────────────────────────────────

const demoGoals: Goal[] = [
  {
    id: 'demo-goal-1',
    name: 'Max Out 401k',
    targetAmount: 250000,
    currentAmount: 195000,
    targetDate: '2027-12-31',
    color: '#4A90D9',
    linkedAccountIds: ['savings::Airtable 401k'],
    priority: 0,
    milestoneReward: 'New watch',
  },
  {
    id: 'demo-goal-2',
    name: 'Emergency Fund to $75k',
    targetAmount: 75000,
    currentAmount: 55000,
    targetDate: '2027-06-01',
    color: '#00D4AA',
    linkedAccountIds: ['savings::Emergency HYS (Marcus)'],
    priority: 1,
  },
  {
    id: 'demo-goal-3',
    name: 'Crypto Portfolio $100k',
    targetAmount: 100000,
    currentAmount: 87000,
    targetDate: '2028-01-01',
    color: '#FFB84D',
    linkedAccountIds: ['savings::Crypto Strike', 'savings::Fidelity Crypto'],
    priority: 2,
    milestoneReward: 'Weekend trip',
  },
];

// ─── Demo expenses ───────────────────────────────────────────────

const demoExpenses: RecurringExpense[] = [
  { id: 'demo-exp-1', name: 'Rent', amount: 2200, frequency: 'Monthly', category: 'Housing', splitWith: [], effectiveAmount: 2200 },
  { id: 'demo-exp-2', name: 'Utilities', amount: 180, frequency: 'Monthly', category: 'Housing', splitWith: [], effectiveAmount: 180 },
  { id: 'demo-exp-3', name: 'Car Payment', amount: 450, frequency: 'Monthly', category: 'Car', splitWith: [], effectiveAmount: 450 },
  { id: 'demo-exp-4', name: 'Car Insurance', amount: 900, frequency: 'Semi-Annual', category: 'Car', splitWith: [], effectiveAmount: 150 },
  { id: 'demo-exp-5', name: 'Groceries', amount: 600, frequency: 'Monthly', category: 'Food & Grocery', splitWith: [], effectiveAmount: 600 },
  { id: 'demo-exp-6', name: 'Dining Out', amount: 350, frequency: 'Monthly', category: 'Food & Grocery', splitWith: [], effectiveAmount: 350 },
  { id: 'demo-exp-7', name: 'Gym', amount: 75, frequency: 'Monthly', category: 'Lifestyle', splitWith: [], effectiveAmount: 75 },
  { id: 'demo-exp-8', name: 'Subscriptions', amount: 85, frequency: 'Monthly', category: 'Lifestyle', splitWith: [], effectiveAmount: 85 },
  { id: 'demo-exp-9', name: 'Student Loan', amount: 320, frequency: 'Monthly', category: 'Debt', splitWith: [], effectiveAmount: 320 },
];

// ─── Export the full demo AppData ────────────────────────────────

export function getDemoData(): AppData {
  return {
    accounts: demoAccounts,
    snapshots: demoSnapshots,
    goals: demoGoals,
    retirementScenarios: [],
    forecastScenarios: [],
    expenses: demoExpenses,
  };
}
