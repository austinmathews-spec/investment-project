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
import { syncFromAirtable, pushGoalToAirtable, deleteGoalFromAirtable, ensureGoalsTable } from '../airtable/sync';
import { getDemoData } from '../data/demoData';

const STORAGE_KEY = '@sofi_dashboard_data';
const CONFIG_KEY = '@sofi_airtable_config';
const FINNHUB_KEY = '@sofi_finnhub_key';

// ─── Demo mode ───────────────────────────────────────────────────

let _demoMode = false;

export function setDemoMode(enabled: boolean): void {
  _demoMode = enabled;
}

export function isDemoMode(): boolean {
  return _demoMode;
}

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
    const config: AirtableConfig = { pat: ENV_PAT, baseId: ENV_BASE_ID };
    // Persist env-var config to AsyncStorage so it survives across sessions
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return config;
  }
  return null;
}

export async function saveAirtableConfig(config: AirtableConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function clearAirtableConfig(): Promise<void> {
  await AsyncStorage.removeItem(CONFIG_KEY);
}

// ─── Finnhub key persistence ─────────────────────────────────────

const ENV_FINNHUB_KEY = process.env.EXPO_PUBLIC_FINNHUB_KEY || '';

export async function loadFinnhubKey(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(FINNHUB_KEY);
  if (raw) return raw;
  if (ENV_FINNHUB_KEY) {
    await AsyncStorage.setItem(FINNHUB_KEY, ENV_FINNHUB_KEY);
    return ENV_FINNHUB_KEY;
  }
  return null;
}

export async function saveFinnhubKey(key: string): Promise<void> {
  await AsyncStorage.setItem(FINNHUB_KEY, key);
}

export async function clearFinnhubKey(): Promise<void> {
  await AsyncStorage.removeItem(FINNHUB_KEY);
}

// ─── Core data persistence ───────────────────────────────────────

export async function loadAppData(): Promise<AppData> {
  if (_demoMode) return getDemoData();
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
  if (_demoMode) return getDemoData();
  const config = await loadAirtableConfig();
  if (!config || !config.pat || !config.baseId) {
    return loadAppData();
  }

  const result = await syncFromAirtable(config.pat, config.baseId);

  // Load existing local data to preserve forecasts and retirement scenarios
  const localData = await loadAppData();

  // Merge goals: Airtable is source of truth, but keep any local-only goals not yet pushed
  const airtableGoalIds = new Set(result.goals.map(g => g.id));
  const localOnlyGoals = localData.goals.filter(g => !airtableGoalIds.has(g.id));

  const merged: AppData = {
    accounts: result.accounts,
    snapshots: result.snapshots,
    expenses: result.expenses,
    goals: [...result.goals, ...localOnlyGoals],
    // These are local-only (not in Airtable)
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

  // Push to Airtable in the background
  const config = await loadAirtableConfig();
  if (config?.pat && config?.baseId && !_demoMode) {
    try {
      await ensureGoalsTable(config.pat, config.baseId);
      const existingId = idx >= 0 ? goal.id : undefined;
      const airtableId = await pushGoalToAirtable(config.pat, config.baseId, goal, existingId);
      // If this was a new goal (no Airtable ID yet), update the local ID to match Airtable
      if (idx < 0 && airtableId !== goal.id) {
        const refreshed = await loadAppData();
        const gIdx = refreshed.goals.findIndex(g => g.id === goal.id);
        if (gIdx >= 0) {
          refreshed.goals[gIdx].id = airtableId;
          await saveAppData(refreshed);
          return refreshed;
        }
      }
    } catch {
      // Airtable push failed silently; data is still saved locally
    }
  }
  return data;
}

export async function deleteGoal(goalId: string): Promise<AppData> {
  const data = await loadAppData();
  data.goals = data.goals.filter((g) => g.id !== goalId);
  await saveAppData(data);

  // Delete from Airtable in the background
  const config = await loadAirtableConfig();
  if (config?.pat && config?.baseId && !_demoMode) {
    try {
      await deleteGoalFromAirtable(config.pat, config.baseId, goalId);
    } catch {
      // Airtable delete failed silently; goal is already removed locally
    }
  }
  return data;
}

export async function reorderGoals(orderedIds: string[]): Promise<AppData> {
  const data = await loadAppData();
  data.goals = data.goals
    .map(g => ({ ...g, priority: orderedIds.indexOf(g.id) }))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
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
