import { AppData, Goal, RetirementScenario } from '../types';
import { formatCurrencyDecimal, accountTypeLabel } from '../utils/format';
import { saveGoal, saveRetirementScenario } from '../storage';
import { v4 as uuid } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_INSTRUCTIONS_KEY = '@sofi_advisor_instructions';
const MEMORY_KEY = '@sofi_advisor_memory';
const MAX_MEMORIES = 20;

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Portfolio context builder ──────────────────────────────────

function buildPortfolioContext(data: AppData): string {
  const totalNetWorth = data.accounts.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + e.effectiveAmount, 0);

  const accountLines = data.accounts
    .sort((a, b) => b.balance - a.balance)
    .map(a => {
      const rate = a.interestRate !== undefined && a.interestRate > 0
        ? ` (${(a.interestRate * 100).toFixed(1)}% APY)`
        : '';
      return `  - ${a.name} [id=${a.id}]: ${formatCurrencyDecimal(a.balance)} [${accountTypeLabel(a.type)}, ${a.institution}]${rate}`;
    })
    .join('\n');

  const goalLines = data.goals.length > 0
    ? data.goals
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
        .map(g => {
          const linkedBal = g.linkedAccountIds && g.linkedAccountIds.length > 0
            ? data.accounts.filter(a => g.linkedAccountIds!.includes(a.id)).reduce((s, a) => s + a.balance, 0)
            : g.currentAmount;
          const pct = g.targetAmount > 0 ? ((linkedBal / g.targetAmount) * 100).toFixed(0) : '0';
          return `  - #${g.priority ?? '?'} ${g.name}: ${formatCurrencyDecimal(linkedBal)} / ${formatCurrencyDecimal(g.targetAmount)} (${pct}%) by ${g.targetDate}${g.milestoneReward ? ` → Reward: ${g.milestoneReward}` : ''}`;
        })
        .join('\n')
    : '  (No goals set)';

  const expenseLines = data.expenses.length > 0
    ? data.expenses
        .sort((a, b) => b.effectiveAmount - a.effectiveAmount)
        .slice(0, 10)
        .map(e => `  - ${e.name}: ${formatCurrencyDecimal(e.effectiveAmount)}/mo [${e.category}]`)
        .join('\n')
    : '  (No expenses tracked)';

  const emergencyAccounts = data.accounts.filter(a =>
    a.name.toLowerCase().includes('emergency') || a.name.toLowerCase().includes('crypto strike')
  );
  const emergencyTotal = emergencyAccounts.reduce((s, a) => s + a.balance, 0);
  const runwayMonths = totalExpenses > 0 ? (emergencyTotal / totalExpenses).toFixed(1) : 'N/A';

  const retirementLines = data.retirementScenarios.length > 0
    ? data.retirementScenarios
        .map(s => `  - ${s.name}: retire at ${s.retirementAge}, ${formatCurrencyDecimal(s.currentSavings)} saved, contributing ${formatCurrencyDecimal(s.monthlyContribution)}/mo, ${(s.annualReturnRate * 100).toFixed(1)}% return`)
        .join('\n')
    : '  (No retirement scenarios)';

  const typeGroups: Record<string, number> = {};
  data.accounts.forEach(a => {
    const label = accountTypeLabel(a.type);
    typeGroups[label] = (typeGroups[label] || 0) + a.balance;
  });
  const allocationLines = Object.entries(typeGroups)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => `  - ${label}: ${formatCurrencyDecimal(value)} (${totalNetWorth > 0 ? ((value / totalNetWorth) * 100).toFixed(1) : 0}%)`)
    .join('\n');

  return `
PORTFOLIO SNAPSHOT (as of today):

Total Net Worth: ${formatCurrencyDecimal(totalNetWorth)}
Monthly Expenses: ${formatCurrencyDecimal(totalExpenses)}/mo
Emergency Runway: ${runwayMonths} months (recommended: 6 months)

ACCOUNTS:
${accountLines}

ASSET ALLOCATION:
${allocationLines}

FINANCIAL GOALS (by priority):
${goalLines}

TOP EXPENSES:
${expenseLines}

RETIREMENT SCENARIOS:
${retirementLines}

USER CONTEXT: 27 years old, born September 8, 1998.
`.trim();
}

// ─── System prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a knowledgeable, friendly personal finance advisor embedded in an investment dashboard app. You have access to the user's full portfolio data below.

Guidelines:
- Give tailored, actionable advice based on the user's ACTUAL numbers
- Be concise but thorough — use bullet points and clear formatting
- Reference specific account names and balances when relevant
- Consider the user's age (27) and goals when making recommendations
- If asked about topics outside finance, politely redirect
- Never give tax or legal advice as professional recommendations — add disclaimers
- Use encouraging but realistic tone
- Format currency amounts clearly
- When discussing allocations, reference actual percentages from their portfolio
- If the user's data is limited, acknowledge that and give general guidance

You can CREATE GOALS and RETIREMENT SCENARIOS for the user by calling the provided functions. When the user asks you to create a goal or forecast/retirement scenario, use the appropriate function. After calling a function, confirm what you created with a brief summary.

You are NOT a replacement for a financial advisor. Always remind users to consult professionals for major decisions.

IMPORTANT: After every response, silently extract 0-2 key facts or preferences the user revealed that would be useful in future conversations (e.g. "User is risk-tolerant", "User wants to retire by 45", "User prefers index funds"). Return these as a JSON block at the VERY END of your response, on its own line, in this exact format:
[MEMORY]{"facts":["fact 1","fact 2"]}[/MEMORY]
If there are no new facts worth remembering, omit the MEMORY block entirely. The user will NOT see this block — it is parsed and stored automatically.`;

// ─── Function declarations for Gemini ───────────────────────────

const TOOL_DECLARATIONS = [
  {
    function_declarations: [
      {
        name: 'create_goal',
        description: 'Create a new financial goal for the user. Use this when the user asks to create, add, or set up a goal.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the goal, e.g. "Get HYS to $50k"' },
            targetAmount: { type: 'NUMBER', description: 'Target dollar amount for the goal' },
            targetDate: { type: 'STRING', description: 'Target date in ISO format YYYY-MM-DD' },
            linkedAccountIds: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Array of account IDs to link to this goal for auto-tracking progress. Use the account IDs from the portfolio data.',
            },
            milestoneReward: { type: 'STRING', description: 'Optional reward text when the goal is reached' },
            priority: { type: 'NUMBER', description: 'Priority rank (lower = higher priority). Use next available number.' },
          },
          required: ['name', 'targetAmount', 'targetDate'],
        },
      },
      {
        name: 'create_retirement_scenario',
        description: 'Create a new retirement planning scenario. Use this when the user asks to create a retirement forecast, plan, or scenario.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the scenario, e.g. "Aggressive Plan"' },
            currentAge: { type: 'NUMBER', description: 'Current age of the user (default 27)' },
            retirementAge: { type: 'NUMBER', description: 'Target retirement age' },
            currentSavings: { type: 'NUMBER', description: 'Current total savings/investments amount' },
            monthlyContribution: { type: 'NUMBER', description: 'Monthly savings/contribution amount' },
            annualReturnRate: { type: 'NUMBER', description: 'Expected annual return rate as decimal (e.g. 0.07 for 7%)' },
            inflationRate: { type: 'NUMBER', description: 'Expected inflation rate as decimal (e.g. 0.03 for 3%)' },
            desiredAnnualIncome: { type: 'NUMBER', description: 'Desired annual income in retirement' },
          },
          required: ['name', 'retirementAge', 'currentSavings', 'monthlyContribution', 'annualReturnRate'],
        },
      },
    ],
  },
];

// ─── Function execution ─────────────────────────────────────────

interface FunctionCallResult {
  name: string;
  response: Record<string, unknown>;
}

async function executeFunctionCall(
  name: string,
  args: Record<string, unknown>,
  data: AppData,
): Promise<FunctionCallResult> {
  if (name === 'create_goal') {
    const nextPriority = data.goals.length > 0
      ? Math.max(...data.goals.map(g => g.priority ?? 0)) + 1
      : 0;

    const goal: Goal = {
      id: uuid(),
      name: args.name as string,
      targetAmount: args.targetAmount as number,
      currentAmount: 0,
      targetDate: args.targetDate as string,
      color: ['#00C805', '#6846EB', '#FFB800', '#FF5000', '#00AAFF', '#E91E63'][data.goals.length % 6],
      linkedAccountIds: (args.linkedAccountIds as string[] | undefined) || [],
      priority: (args.priority as number | undefined) ?? nextPriority,
      milestoneReward: (args.milestoneReward as string | undefined) || undefined,
    };

    await saveGoal(goal);
    return {
      name,
      response: {
        success: true,
        goalId: goal.id,
        goalName: goal.name,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
      },
    };
  }

  if (name === 'create_retirement_scenario') {
    const scenario: RetirementScenario = {
      id: uuid(),
      name: args.name as string,
      currentAge: (args.currentAge as number | undefined) ?? 27,
      retirementAge: args.retirementAge as number,
      currentSavings: args.currentSavings as number,
      monthlyContribution: args.monthlyContribution as number,
      annualReturnRate: args.annualReturnRate as number,
      inflationRate: (args.inflationRate as number | undefined) ?? 0.03,
      desiredAnnualIncome: (args.desiredAnnualIncome as number | undefined) ?? 80000,
    };

    await saveRetirementScenario(scenario);
    return {
      name,
      response: {
        success: true,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        retirementAge: scenario.retirementAge,
        monthlyContribution: scenario.monthlyContribution,
      },
    };
  }

  return { name, response: { success: false, error: 'Unknown function' } };
}

// ─── Public API ─────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  action?: string; // e.g. "Created goal: Get HYS to $50k"
}

export interface SendResult {
  text: string;
  action?: string;
}

// ─── Memory helpers ─────────────────────────────────────────────

export async function loadMemories(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(MEMORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

async function saveMemories(memories: string[]): Promise<void> {
  await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(memories.slice(-MAX_MEMORIES)));
}

function extractAndStripMemory(text: string): { clean: string; facts: string[] } {
  const match = text.match(/\[MEMORY\](.*?)\[\/MEMORY\]/s);
  if (!match) return { clean: text, facts: [] };
  const clean = text.replace(/\[MEMORY\].*?\[\/MEMORY\]/s, '').trim();
  try {
    const parsed = JSON.parse(match[1]);
    return { clean, facts: Array.isArray(parsed.facts) ? parsed.facts : [] };
  } catch {
    return { clean, facts: [] };
  }
}

export async function clearMemories(): Promise<void> {
  await AsyncStorage.removeItem(MEMORY_KEY);
}

export async function loadCustomInstructions(): Promise<string> {
  return (await AsyncStorage.getItem(CUSTOM_INSTRUCTIONS_KEY)) || '';
}

// ─── Main chat function ─────────────────────────────────────────

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  appData: AppData,
  apiKey?: string,
): Promise<SendResult> {
  const key = apiKey || GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API key not configured. Add it in Settings.');
  }

  const portfolioContext = buildPortfolioContext(appData);
  const customInstructions = await loadCustomInstructions();
  const memories = await loadMemories();

  let systemBlock = SYSTEM_PROMPT;
  if (customInstructions) {
    systemBlock += `\n\nUSER'S CUSTOM INSTRUCTIONS (always follow these):\n${customInstructions}`;
  }
  if (memories.length > 0) {
    systemBlock += `\n\nTHINGS I REMEMBER ABOUT THE USER:\n${memories.map(m => `• ${m}`).join('\n')}`;
  }

  // Build conversation contents
  const contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }> = [];

  // First user message includes system prompt + context
  const firstUserText = history.length === 0 ? userMessage : history[0].text;
  contents.push({
    role: 'user',
    parts: [{ text: `${systemBlock}\n\n${portfolioContext}\n\n---\n\nUser question: ${firstUserText}` }],
  });

  if (history.length > 0) {
    // Add remaining history
    for (let i = 1; i < history.length; i++) {
      contents.push({
        role: history[i].role === 'user' ? 'user' : 'model',
        parts: [{ text: history[i].text }],
      });
    }
    // Current message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });
  }

  // First call — may return text or a function call
  const firstResponse = await callGemini(key, contents) as GeminiResponse;
  const candidate = firstResponse?.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  // If it's a function call, execute it and send the result back
  if (part?.functionCall) {
    const fc = part.functionCall as { name: string; args: Record<string, unknown> };
    const result = await executeFunctionCall(fc.name, fc.args, appData);

    // Append the model's function call + our response
    contents.push({
      role: 'model',
      parts: [{ functionCall: part.functionCall }],
    });
    contents.push({
      role: 'function' as string,
      parts: [{ functionResponse: { name: result.name, response: result.response } }],
    });

    // Second call to get natural language response
    const secondResponse = await callGemini(key, contents) as GeminiResponse;
    const rawText2 = secondResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 'Done!';
    const { clean: text2, facts: facts2 } = extractAndStripMemory(rawText2);
    if (facts2.length > 0) {
      const existing = await loadMemories();
      await saveMemories([...existing, ...facts2]);
    }
    const actionLabel = fc.name === 'create_goal'
      ? `Created goal: ${fc.args.name}`
      : `Created retirement scenario: ${fc.args.name}`;
    return { text: text2, action: actionLabel };
  }

  // Plain text response
  const rawText = part?.text;
  if (!rawText) {
    throw new Error('No response from Gemini');
  }
  const { clean, facts } = extractAndStripMemory(rawText);
  if (facts.length > 0) {
    const existing = await loadMemories();
    await saveMemories([...existing, ...facts]);
  }
  return { text: clean };
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

async function callGemini(
  key: string,
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      tools: TOOL_DECLARATIONS,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errBody}`);
  }

  return response.json();
}
