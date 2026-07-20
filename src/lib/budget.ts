import { supabase } from '@/lib/supabaseClient';
import { bangkokMonthRange, currentBangkokMonth } from '@/lib/bangkokDate';

interface MonthlyBudget {
  id: string;
  incomeSatang: number;
}

interface BudgetCategoryRow {
  id: string;
  label: string;
  amountSatang: number;
}

interface RelevantTransaction {
  type: 'income' | 'expense' | 'debt_payment' | 'transfer' | 'refund';
  amountSatang: number;
  categoryLabel: string | null;
}

async function getMonthlyBudget(month: string): Promise<MonthlyBudget | null> {
  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('id, income_satang')
    .eq('month', month)
    .maybeSingle();
  if (error) throw new Error('โหลดงบประมาณไม่สำเร็จ');
  return data ? { id: data.id, incomeSatang: Number(data.income_satang) } : null;
}

async function listBudgetCategories(monthlyBudgetId: string): Promise<BudgetCategoryRow[]> {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('id, label, amount_satang')
    .eq('monthly_budget_id', monthlyBudgetId);
  if (error) throw new Error('โหลดหมวดงบประมาณไม่สำเร็จ');
  return (data ?? []).map((row) => ({ id: row.id, label: row.label, amountSatang: Number(row.amount_satang) }));
}

async function listMonthTransactions(month: string): Promise<RelevantTransaction[]> {
  const { start, end } = bangkokMonthRange(month);
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount_satang, category_label')
    .eq('status', 'confirmed')
    .gte('occurred_at', start)
    .lt('occurred_at', end);
  if (error) throw new Error('โหลดรายการเดือนนี้ไม่สำเร็จ');
  return (data ?? []).map((row) => ({ type: row.type, amountSatang: Number(row.amount_satang), categoryLabel: row.category_label }));
}

// --- Pure calculations, ported from tanglak/src/lib/finance/budget-calculations.ts.
// Simplification vs. the web app: category matching is exact-label only
// (no legacy-alias normalization via resolveCategoryFromLegacyLabel) --
// fine for labels this mobile client itself writes (always canonical, see
// src/lib/categories.ts), but a very old legacy-labeled transaction from
// the web app could show up as "uncategorized" here instead of merging
// into its canonical bucket. ---

export type BudgetStatus = 'healthy' | 'near_limit' | 'overspent' | 'no_budget';

const BUDGET_NEAR_LIMIT_THRESHOLD = 0.8;
const BUDGET_OVERSPENT_THRESHOLD = 1;

function transactionSpendDelta(transaction: RelevantTransaction): number {
  switch (transaction.type) {
    case 'expense':
    case 'debt_payment':
      return transaction.amountSatang;
    case 'refund':
      return -transaction.amountSatang;
    default:
      return 0;
  }
}

function calculateCategorySpend(transactions: RelevantTransaction[]): { byLabel: Record<string, number>; uncategorizedSatang: number } {
  const raw: Record<string, number> = {};
  let uncategorizedSatang = 0;
  for (const transaction of transactions) {
    const delta = transactionSpendDelta(transaction);
    if (delta === 0) continue;
    const label = transaction.categoryLabel?.trim();
    if (!label) {
      uncategorizedSatang += delta;
      continue;
    }
    raw[label] = (raw[label] ?? 0) + delta;
  }
  const byLabel: Record<string, number> = {};
  for (const [label, amount] of Object.entries(raw)) byLabel[label] = Math.max(0, amount);
  return { byLabel, uncategorizedSatang: Math.max(0, uncategorizedSatang) };
}

export function statusForCategory(budgetedSatang: number, spentSatang: number): BudgetStatus {
  if (budgetedSatang <= 0) return 'no_budget';
  const ratio = spentSatang / budgetedSatang;
  if (ratio > BUDGET_OVERSPENT_THRESHOLD) return 'overspent';
  if (ratio >= BUDGET_NEAR_LIMIT_THRESHOLD) return 'near_limit';
  return 'healthy';
}

export interface CategorySummary {
  label: string;
  budgetedSatang: number;
  spentSatang: number;
  usagePercent: number | null;
  status: BudgetStatus;
}

function summarizeCategory(label: string, budgetedSatang: number, spentSatang: number): CategorySummary {
  return {
    label,
    budgetedSatang,
    spentSatang,
    usagePercent: budgetedSatang > 0 ? spentSatang / budgetedSatang : null,
    status: statusForCategory(budgetedSatang, spentSatang),
  };
}

export interface BudgetSummary {
  month: string;
  hasBudget: boolean;
  expectedIncomeSatang: number;
  plannedTotalSatang: number;
  spentTotalSatang: number;
  remainingTotalSatang: number;
  uncategorizedSpentSatang: number;
  categories: CategorySummary[];
}

export async function getBudgetSummaryForCurrentMonth(): Promise<BudgetSummary> {
  const month = currentBangkokMonth();
  const budget = await getMonthlyBudget(month);
  const categories = budget ? await listBudgetCategories(budget.id) : [];
  const transactions = await listMonthTransactions(month);
  const spend = calculateCategorySpend(transactions);

  const categorySummaries = categories.map((category) => summarizeCategory(category.label, category.amountSatang, spend.byLabel[category.label] ?? 0));

  const budgetedLabels = new Set(categorySummaries.map((c) => c.label));
  for (const [label, spentSatang] of Object.entries(spend.byLabel)) {
    if (budgetedLabels.has(label)) continue;
    categorySummaries.push(summarizeCategory(label, 0, spentSatang));
  }

  function priority(category: CategorySummary): number {
    if (category.spentSatang > 0 && category.budgetedSatang > 0) return 0;
    if (category.spentSatang > 0) return 1;
    return 2;
  }
  categorySummaries.sort((a, b) => priority(a) - priority(b) || a.label.localeCompare(b.label, 'th'));

  const plannedTotalSatang = categories.reduce((sum, c) => sum + c.amountSatang, 0);
  const spentTotalSatang = categorySummaries.reduce((sum, c) => sum + c.spentSatang, 0) + spend.uncategorizedSatang;

  return {
    month,
    hasBudget: budget !== null,
    expectedIncomeSatang: budget?.incomeSatang ?? 0,
    plannedTotalSatang,
    spentTotalSatang,
    remainingTotalSatang: plannedTotalSatang - spentTotalSatang,
    uncategorizedSpentSatang: spend.uncategorizedSatang,
    categories: categorySummaries,
  };
}
