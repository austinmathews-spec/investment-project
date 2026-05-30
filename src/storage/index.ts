import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Account,
  NetWorthSnapshot,
  Goal,
  RetirementScenario,
  ForecastScenario,
  RecurringExpense,
  AirtableConfig,
  AppData,
} from '../types';
import { syncFromAirtable } from '../airtable/sync';

const STORAGE_KEY = '@sofi_dashboard_data';
const CONFIG_KEY = '@sofi_airtable_config';

const emptyData: AppData = {
  accounts: [],
  snapshots: [],
  goals: [],
  retirementScenarios: [],
  forecastScenarios: [],
  expenses: [],
};

// ─── Airtable config persistence ─────────────────────────────────

const ENV_PAT = process.env.EXPO_PUBLIC_AIRTABLE_PAT || '';
const ENV_BASE_ID = process.env.EXPO_PUBLIC_AIRTABLE_BASE_ID || '';

export async function loadAirtableConfig(): Promise<AirtableConfig | null> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  if (raw) return JSON.parse(raw) as AirtableConfig;
  // Fall back to environment variables (for Vercel deployment)
  if (ENV_PAT && ENV_BASE_ID) {
    return { pat: ENV_PAT, baseId: ENV_BASE_ID };
  }
  return null;
}

export async function saveAirtableConfig(config: AirtableConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function clearAirtableConfig(): Promise<void> {
  await AsyncStorage.removeItem(CONFIG_KEY);
}

// ─── Core data persistence ───────────────────────────────────────

export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { accounts: [], snapshots: [], goals: [], retirementScenarios: [], forecastScenarios: [], expenses: [] };
  }
  const parsed = JSON.parse(raw) as AppData;
  // Ensure expenses array exists for older cached data
  if (!parsed.expenses) parsed.expenses = [];
  // Backfill sourceTable for older cached accounts
  parsed.accounts = parsed.accounts.map(a => ({
    ...a,
    sourceTable: a.sourceTable || 'Local',
  }));
  return parsed;
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function resetAppData(): Promise<AppData> {
  const fresh: AppData = { accounts: [], snapshots: [], goals: [], retirementScenarios: [], forecastScenarios: [], expenses: [] };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

// ─── Airtable sync ───────────────────────────────────────────────

export async function syncWithAirtable(): Promise<AppData> {
  const config = await loadAirtableConfig();
  if (!config || !config.pat || !config.baseId) {
    return loadAppData();
  }

  const result = await syncFromAirtable(config.pat, config.baseId);

  // Load existing local data to preserve goals, forecasts, retirement scenarios
  const localData = await loadAppData();

  const merged: AppData = {
    accounts: result.accounts,
    snapshots: result.snapshots,
    expenses: result.expenses,
    // These are local-only (not in Airtable)
    goals: localData.goals,
    retirementScenarios: localData.retirementScenarios,
    forecastScenarios: localData.forecastScenarios,
  };

  await saveAppData(merged);
  return merged;
}

// ─── Account helpers ─────────────────────────────────────────────

export async function saveAccount(account: Account): Promise<AppData> {
  const data = await loadAppData();
  const idx = data.accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    data.accounts[idx] = account;
  } else {
    data.accounts.push(account);
  }
  await saveAppData(data);
  return data;
}

export async function deleteAccount(accountId: string): Promise<AppData> {
  const data = await loadAppData();
  data.accounts = data.accounts.filter((a) => a.id !== accountId);
  await saveAppData(data);
  return data;
}

// ─── Snapshot helpers ────────────────────────────────────────────

export async function saveSnapshot(snapshot: NetWorthSnapshot): Promise<AppData> {
  const data = await loadAppData();
  const idx = data.snapshots.findIndex((s) => s.id === snapshot.id);
  if (idx >= 0) {
    data.snapshots[idx] = snapshot;
  } else {
    data.snapshots.push(snapshot);
  }
  data.snapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  await saveAppData(data);
  return data;
}

// ─── Goal helpers ────────────────────────────────────────────────

export async function saveGoal(goal: Goal): Promise<AppData> {
  const data = await loadAppData();
  const idx = data.goals.findIndex((g) => g.id === goal.id);
  if (idx >= 0) {
    data.goals[idx] = goal;
  } else {
    data.goals.push(goal);
  }
  await saveAppData(data);
  return data;
}

export async function deleteGoal(goalId: string): Promise<AppData> {
  const data = await loadAppData();
  data.goals = data.goals.filter((g) => g.id !== goalId);
  await saveAppData(data);
  return data;
}

// ─── Retirement scenario helpers ─────────────────────────────────

export async function saveRetirementScenario(scenario: RetirementScenario): Promise<AppData> {
  const data = await loadAppData();
  const idx = data.retirementScenarios.findIndex((s) => s.id === scenario.id);
  if (idx >= 0) {
    data.retirementScenarios[idx] = scenario;
  } else {
    data.retirementScenarios.push(scenario);
  }
  await saveAppData(data);
  return data;
}

export async function deleteRetirementScenario(scenarioId: string): Promise<AppData> {
  const data = await loadAppData();
  data.retirementScenarios = data.retirementScenarios.filter((s) => s.id !== scenarioId);
  await saveAppData(data);
  return data;
}

// ─── Forecast scenario helpers ───────────────────────────────────

export async function saveForecastScenario(scenario: ForecastScenario): Promise<AppData> {
  const data = await loadAppData();
  const idx = data.forecastScenarios.findIndex((s) => s.id === scenario.id);
  if (idx >= 0) {
    data.forecastScenarios[idx] = scenario;
  } else {
    data.forecastScenarios.push(scenario);
  }
  await saveAppData(data);
  return data;
}

export async function deleteForecastScenario(scenarioId: string): Promise<AppData> {
  const data = await loadAppData();
  data.forecastScenarios = data.forecastScenarios.filter((s) => s.id !== scenarioId);
  await saveAppData(data);
  return data;
}

// ─── Expense helpers ─────────────────────────────────────────────

export async function saveExpense(expense: RecurringExpense): Promise<AppData> {
  const data = await loadAppData();
  const idx = data.expenses.findIndex((e) => e.id === expense.id);
  if (idx >= 0) {
    data.expenses[idx] = expense;
  } else {
    data.expenses.push(expense);
  }
  await saveAppData(data);
  return data;
}

export async function deleteExpense(expenseId: string): Promise<AppData> {
  const data = await loadAppData();
  data.expenses = data.expenses.filter((e) => e.id !== expenseId);
  await saveAppData(data);
  return data;
}
