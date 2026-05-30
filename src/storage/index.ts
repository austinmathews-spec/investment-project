import AsyncStorage from '@react-native-async-storage/async-storage';
import { Account, NetWorthSnapshot, Goal, RetirementScenario, ForecastScenario, AppData } from '../types';
import {
  sampleAccounts,
  sampleSnapshots,
  sampleGoals,
  sampleRetirementScenario,
  sampleForecastScenario,
} from '../data/mockData';

const STORAGE_KEY = '@sofi_dashboard_data';

const defaultData: AppData = {
  accounts: sampleAccounts,
  snapshots: sampleSnapshots,
  goals: sampleGoals,
  retirementScenarios: [sampleRetirementScenario],
  forecastScenarios: [sampleForecastScenario],
};

export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(raw) as AppData;
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function resetAppData(): Promise<AppData> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
  return defaultData;
}

// --- Account helpers ---
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

// --- Snapshot helpers ---
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

// --- Goal helpers ---
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

// --- Retirement scenario helpers ---
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

// --- Forecast scenario helpers ---
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
