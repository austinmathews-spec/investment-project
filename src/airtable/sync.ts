import { listRecords, createRecord, updateRecord, deleteRecord, createTable, listTables } from './client';
import {
  Account,
  AccountType,
  SourceTable,
  NetWorthSnapshot,
  RecurringExpense,
  ExpenseFrequency,
  ExpenseCategory,
  Goal,
} from '../types';

// ─── Column → Account mapping ────────────────────────────────────

interface ColumnMapping {
  fieldName: string;
  accountName: string;
  type: AccountType;
  institution: string;
  table: 'savings' | 'debt';
}

const SAVINGS_COLUMNS: ColumnMapping[] = [
  { fieldName: 'Emergency HYS (Marcus)', accountName: 'Emergency HYS', type: 'savings', institution: 'Marcus', table: 'savings' },
  { fieldName: 'Cash HYS (Sofi)', accountName: 'Cash HYS', type: 'savings', institution: 'SoFi', table: 'savings' },
  { fieldName: 'Cash Checking (Sofi)', accountName: 'Cash Checking', type: 'checking', institution: 'SoFi', table: 'savings' },
  { fieldName: 'Debit (Bofa)', accountName: 'Debit', type: 'checking', institution: 'BofA', table: 'savings' },
  { fieldName: 'Crypto Strike', accountName: 'Crypto Strike', type: 'crypto', institution: 'Strike', table: 'savings' },
  { fieldName: 'Fidelity Crypto', accountName: 'Fidelity Crypto', type: 'crypto', institution: 'Fidelity', table: 'savings' },
  { fieldName: 'Airtable 401k', accountName: '401k', type: '401k', institution: 'Airtable', table: 'savings' },
  { fieldName: 'Roth IRA', accountName: 'Roth IRA', type: 'roth_ira', institution: '', table: 'savings' },
  { fieldName: 'Rollover IRA', accountName: 'Rollover IRA', type: 'traditional_ira', institution: '', table: 'savings' },
  { fieldName: 'HSA', accountName: 'HSA', type: 'hsa', institution: '', table: 'savings' },
];

const SKIP_FIELDS = new Set([
  'Date',
  'Total Savings & Retirement',
  'Total Non-Liquid Assets',
  'Total Debt',
  '$SPY Price for Reference',
  '$BTC Price for Reference',
  'Calculation Hub',
]);

function fieldToId(fieldName: string, table: string): string {
  return `${table}::${fieldName}`;
}

function guessAccountType(fieldName: string): AccountType {
  const lower = fieldName.toLowerCase();
  if (lower.includes('401k') || lower.includes('401(k)')) return '401k';
  if (lower.includes('roth')) return 'roth_ira';
  if (lower.includes('rollover') || lower.includes('traditional ira')) return 'traditional_ira';
  if (lower.includes('hsa')) return 'hsa';
  if (lower.includes('529')) return '529';
  if (lower.includes('crypto') || lower.includes('btc') || lower.includes('bitcoin') || lower.includes('strike')) return 'crypto';
  if (lower.includes('checking') || lower.includes('debit')) return 'checking';
  if (lower.includes('hys') || lower.includes('saving') || lower.includes('marcus')) return 'savings';
  if (lower.includes('brokerage') || lower.includes('fidelity') || lower.includes('schwab') || lower.includes('vanguard') || lower.includes('robinhood')) return 'brokerage';
  return 'other';
}

function guessInstitution(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (lower.includes('sofi')) return 'SoFi';
  if (lower.includes('marcus')) return 'Marcus';
  if (lower.includes('bofa') || lower.includes('bank of america')) return 'BofA';
  if (lower.includes('fidelity')) return 'Fidelity';
  if (lower.includes('schwab')) return 'Schwab';
  if (lower.includes('vanguard')) return 'Vanguard';
  if (lower.includes('strike')) return 'Strike';
  if (lower.includes('robinhood')) return 'Robinhood';
  if (lower.includes('airtable')) return 'Airtable';
  if (lower.includes('coinbase')) return 'Coinbase';
  return '';
}

// ─── Fetch helpers ───────────────────────────────────────────────

interface AirtableFields {
  [key: string]: unknown;
}

interface AirtableRecord {
  id: string;
  fields: AirtableFields;
  createdTime: string;
}

export async function fetchSavingsInvestment(
  pat: string,
  baseId: string
): Promise<AirtableRecord[]> {
  return listRecords<AirtableFields>(pat, baseId, 'Saving & Investment');
}

export async function fetchDebt(
  pat: string,
  baseId: string
): Promise<AirtableRecord[]> {
  return listRecords<AirtableFields>(pat, baseId, 'Debt');
}

export async function fetchCalculationHub(
  pat: string,
  baseId: string
): Promise<AirtableRecord[]> {
  return listRecords<AirtableFields>(pat, baseId, 'Calculation Hub');
}

export async function fetchRecurringExpenses(
  pat: string,
  baseId: string
): Promise<AirtableRecord[]> {
  return listRecords<AirtableFields>(pat, baseId, 'Recurring Expenses');
}

export async function fetchGoals(
  pat: string,
  baseId: string
): Promise<AirtableRecord[]> {
  try {
    return await listRecords<AirtableFields>(pat, baseId, 'Goals');
  } catch {
    // Table may not exist yet; return empty
    return [];
  }
}

// ─── Parse Airtable data into app types ──────────────────────────

function getCurrencyColumns(
  records: AirtableRecord[],
  knownSkip: Set<string>
): string[] {
  const cols = new Set<string>();
  for (const rec of records) {
    for (const [key, val] of Object.entries(rec.fields)) {
      if (!knownSkip.has(key) && typeof val === 'number') {
        cols.add(key);
      }
    }
  }
  return Array.from(cols);
}

export function parseAccounts(
  savingsRecords: AirtableRecord[],
  debtRecords: AirtableRecord[]
): Account[] {
  const accounts: Account[] = [];

  // Sort by date desc to get latest
  const sortedSavings = [...savingsRecords].sort(
    (a, b) =>
      new Date(b.fields.Date as string).getTime() -
      new Date(a.fields.Date as string).getTime()
  );
  const latest = sortedSavings[0];

  if (latest) {
    // Known columns first (for nice names/types/institutions)
    const knownFieldNames = new Set(SAVINGS_COLUMNS.map((c) => c.fieldName));
    for (const col of SAVINGS_COLUMNS) {
      if (!(col.fieldName in latest.fields)) continue;
      const balance = (latest.fields[col.fieldName] as number) ?? 0;
      accounts.push({
        id: fieldToId(col.fieldName, 'savings'),
        name: col.accountName,
        type: col.type,
        balance,
        institution: col.institution,
        lastUpdated: latest.fields.Date as string,
        sourceTable: 'Savings & Investment',
      });
    }

    // Dynamically discover any NEW numeric columns not in the known list
    for (const [key, val] of Object.entries(latest.fields)) {
      if (knownFieldNames.has(key) || SKIP_FIELDS.has(key) || typeof val !== 'number') continue;
      accounts.push({
        id: fieldToId(key, 'savings'),
        name: key.replace(/\s*\(.*?\)\s*$/, ''), // strip trailing parenthetical
        type: guessAccountType(key),
        balance: val,
        institution: guessInstitution(key),
        lastUpdated: latest.fields.Date as string,
        sourceTable: 'Savings & Investment',
      });
    }
  }

  // Debt (show as negative)
  const sortedDebt = [...debtRecords].sort(
    (a, b) =>
      new Date(b.fields.Date as string).getTime() -
      new Date(a.fields.Date as string).getTime()
  );
  const latestDebt = sortedDebt[0];

  if (latestDebt) {
    const debtCols = getCurrencyColumns([latestDebt], SKIP_FIELDS);
    for (const colName of debtCols) {
      const balance = (latestDebt.fields[colName] as number) ?? 0;
      if (balance !== 0) {
        accounts.push({
          id: fieldToId(colName, 'debt'),
          name: colName,
          type: 'other',
          balance,
          institution: '',
          lastUpdated: latestDebt.fields.Date as string,
          sourceTable: 'Debt',
        });
      }
    }
  }

  return accounts;
}

export function parseSnapshots(
  calcHubRecords: AirtableRecord[],
  savingsRecords: AirtableRecord[],
  debtRecords: AirtableRecord[]
): NetWorthSnapshot[] {
  const sorted = [...calcHubRecords].sort(
    (a, b) =>
      new Date(a.fields.Date as string).getTime() -
      new Date(b.fields.Date as string).getTime()
  );

  // Build lookup maps by date
  const savingsByDate = new Map<string, AirtableFields>();
  for (const r of savingsRecords) {
    savingsByDate.set(r.fields.Date as string, r.fields);
  }
  const debtByDate = new Map<string, AirtableFields>();
  for (const r of debtRecords) {
    debtByDate.set(r.fields.Date as string, r.fields);
  }

  return sorted.map((rec) => {
    const date = rec.fields.Date as string;
    const totalNetworth = (rec.fields['Total Networth'] as number) ?? 0;

    // Extract lookup values (Airtable returns them as arrays)
    const totalSavings = extractLookup(rec.fields['Total Savings & Retirement']);
    const totalDebtVal = extractLookup(rec.fields['Total Debt & Liabilities']);

    const totalAssets = totalSavings;
    const totalLiabilities = Math.abs(totalDebtVal);

    // Build per-account balances
    const accountBalances: Record<string, number> = {};
    const savingsFields = savingsByDate.get(date);
    if (savingsFields) {
      for (const col of SAVINGS_COLUMNS) {
        accountBalances[fieldToId(col.fieldName, 'savings')] =
          (savingsFields[col.fieldName] as number) ?? 0;
      }
      // Include dynamically discovered columns in snapshot balances
      const knownFieldNames = new Set(SAVINGS_COLUMNS.map((c) => c.fieldName));
      for (const [key, val] of Object.entries(savingsFields)) {
        if (knownFieldNames.has(key) || SKIP_FIELDS.has(key) || typeof val !== 'number') continue;
        accountBalances[fieldToId(key, 'savings')] = val;
      }
    }

    return {
      id: rec.id,
      date,
      totalAssets,
      totalLiabilities,
      netWorth: totalNetworth,
      accountBalances,
    };
  });
}

function extractLookup(val: unknown): number {
  if (typeof val === 'number') return val;
  if (Array.isArray(val) && val.length > 0) return val[0] as number;
  return 0;
}

export function parseExpenses(records: AirtableRecord[]): RecurringExpense[] {
  return records.map((rec) => ({
    id: rec.id,
    airtableId: rec.id,
    name: (rec.fields.Name as string) ?? '',
    amount: (rec.fields.Amount as number) ?? 0,
    frequency: ((rec.fields.Frequency as string) ?? 'Monthly') as ExpenseFrequency,
    category: ((rec.fields.Category as string) ?? 'Lifestyle') as ExpenseCategory,
    splitWith: (rec.fields['Split With?'] as string[]) ?? [],
    effectiveAmount: (rec.fields['Effective Amount'] as number) ?? 0,
  }));
}

export function parseGoals(records: AirtableRecord[]): Goal[] {
  return records.map((rec) => ({
    id: rec.id,
    name: (rec.fields.Name as string) ?? '',
    targetAmount: (rec.fields.TargetAmount as number) ?? 0,
    currentAmount: (rec.fields.CurrentAmount as number) ?? 0,
    targetDate: (rec.fields.TargetDate as string) ?? '',
    color: (rec.fields.Color as string) ?? '#4A90D9',
    linkedAccountIds: rec.fields.LinkedAccountIds
      ? JSON.parse(rec.fields.LinkedAccountIds as string)
      : undefined,
    priority: (rec.fields.Priority as number) ?? undefined,
    milestoneReward: (rec.fields.MilestoneReward as string) || undefined,
  }));
}

// ─── Write helpers ───────────────────────────────────────────────

export async function createSavingsSnapshot(
  pat: string,
  baseId: string,
  accountBalances: Record<string, number>,
  date: string
): Promise<void> {
  const fields: Record<string, unknown> = { Date: date };
  for (const [accountId, balance] of Object.entries(accountBalances)) {
    if (!accountId.startsWith('savings::')) continue;
    const fieldName = accountId.replace('savings::', '');
    fields[fieldName] = balance;
  }
  await createRecord(pat, baseId, 'Saving & Investment', fields);
}

export async function updateSavingsRecord(
  pat: string,
  baseId: string,
  recordId: string,
  fieldName: string,
  value: number
): Promise<void> {
  await updateRecord(pat, baseId, 'Saving & Investment', recordId, {
    [fieldName]: value,
  });
}

export async function createExpense(
  pat: string,
  baseId: string,
  expense: { name: string; amount: number; frequency: string; category: string }
): Promise<void> {
  await createRecord(pat, baseId, 'Recurring Expenses', {
    Name: expense.name,
    Amount: expense.amount,
    Frequency: expense.frequency,
    Category: expense.category,
  });
}

// ─── Goal CRUD ──────────────────────────────────────────────────

function goalToAirtableFields(goal: Goal): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    Name: goal.name,
    TargetAmount: goal.targetAmount,
    CurrentAmount: goal.currentAmount,
    TargetDate: goal.targetDate,
    Color: goal.color,
  };
  if (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) {
    fields.LinkedAccountIds = JSON.stringify(goal.linkedAccountIds);
  }
  if (goal.priority != null) {
    fields.Priority = goal.priority;
  }
  if (goal.milestoneReward) {
    fields.MilestoneReward = goal.milestoneReward;
  }
  return fields;
}

export async function pushGoalToAirtable(
  pat: string,
  baseId: string,
  goal: Goal,
  existingAirtableId?: string
): Promise<string> {
  if (existingAirtableId) {
    await updateRecord(pat, baseId, 'Goals', existingAirtableId, goalToAirtableFields(goal));
    return existingAirtableId;
  }
  const created = await createRecord(pat, baseId, 'Goals', goalToAirtableFields(goal));
  return created.id;
}

export async function deleteGoalFromAirtable(
  pat: string,
  baseId: string,
  airtableId: string
): Promise<void> {
  await deleteRecord(pat, baseId, 'Goals', airtableId);
}

export async function ensureGoalsTable(
  pat: string,
  baseId: string
): Promise<void> {
  try {
    const tables = await listTables(pat, baseId);
    if (tables.some(t => t.name === 'Goals')) return;
  } catch {
    // If listing tables fails, fall through to create attempt
  }
  await createTable(pat, baseId, 'Goals', [
    { name: 'Name', type: 'singleLineText' },
    { name: 'TargetAmount', type: 'number', options: { precision: 2 } },
    { name: 'CurrentAmount', type: 'number', options: { precision: 2 } },
    { name: 'TargetDate', type: 'singleLineText' },
    { name: 'Color', type: 'singleLineText' },
    { name: 'LinkedAccountIds', type: 'singleLineText' },
    { name: 'Priority', type: 'number', options: { precision: 0 } },
    { name: 'MilestoneReward', type: 'singleLineText' },
  ]);
}

// ─── Full sync ──────────────────────────────────────────────────

export interface AirtableSyncResult {
  accounts: Account[];
  snapshots: NetWorthSnapshot[];
  expenses: RecurringExpense[];
  goals: Goal[];
  spyPrice?: number;
  btcPrice?: number;
}

export async function syncFromAirtable(
  pat: string,
  baseId: string
): Promise<AirtableSyncResult> {
  const [savingsRecs, debtRecs, calcHubRecs, expenseRecs, goalRecs] =
    await Promise.all([
      fetchSavingsInvestment(pat, baseId),
      fetchDebt(pat, baseId),
      fetchCalculationHub(pat, baseId),
      fetchRecurringExpenses(pat, baseId),
      fetchGoals(pat, baseId),
    ]);

  const accounts = parseAccounts(savingsRecs, debtRecs);
  const snapshots = parseSnapshots(calcHubRecs, savingsRecs, debtRecs);
  const expenses = parseExpenses(expenseRecs);
  const goals = parseGoals(goalRecs);

  // Extract reference prices from latest savings record
  const sortedSavings = [...savingsRecs].sort(
    (a, b) =>
      new Date(b.fields.Date as string).getTime() -
      new Date(a.fields.Date as string).getTime()
  );
  const latest = sortedSavings[0];
  const spyPrice = latest
    ? (latest.fields['$SPY Price for Reference'] as number)
    : undefined;
  const btcPrice = latest
    ? (latest.fields['$BTC Price for Reference'] as number)
    : undefined;

  return { accounts, snapshots, expenses, goals, spyPrice, btcPrice };
}
