import { listRecords, createRecord, updateRecord } from './client';
import {
  Account,
  AccountType,
  SourceTable,
  NetWorthSnapshot,
  RecurringExpense,
  ExpenseFrequency,
  ExpenseCategory,
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
    for (const col of SAVINGS_COLUMNS) {
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

// ─── Write helpers ───────────────────────────────────────────────

export async function createSavingsSnapshot(
  pat: string,
  baseId: string,
  accountBalances: Record<string, number>,
  date: string
): Promise<void> {
  const fields: Record<string, unknown> = { Date: date };
  for (const col of SAVINGS_COLUMNS) {
    const id = fieldToId(col.fieldName, 'savings');
    if (id in accountBalances) {
      fields[col.fieldName] = accountBalances[id];
    }
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

// ─── Full sync ──────────────────────────────────────────────────

export interface AirtableSyncResult {
  accounts: Account[];
  snapshots: NetWorthSnapshot[];
  expenses: RecurringExpense[];
  spyPrice?: number;
  btcPrice?: number;
}

export async function syncFromAirtable(
  pat: string,
  baseId: string
): Promise<AirtableSyncResult> {
  const [savingsRecs, debtRecs, calcHubRecs, expenseRecs] =
    await Promise.all([
      fetchSavingsInvestment(pat, baseId),
      fetchDebt(pat, baseId),
      fetchCalculationHub(pat, baseId),
      fetchRecurringExpenses(pat, baseId),
    ]);

  const accounts = parseAccounts(savingsRecs, debtRecs);
  const snapshots = parseSnapshots(calcHubRecs, savingsRecs, debtRecs);
  const expenses = parseExpenses(expenseRecs);

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

  return { accounts, snapshots, expenses, spyPrice, btcPrice };
}
