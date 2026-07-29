// "AI-assisted" budget suggestion -- despite the name, this is pure
// client-side analysis of the user's own already-categorized transaction
// history, not a new Gemini/AI call. Every transaction here was already
// categorized (by the user, by merchantRules.ts, or by the AI slip-scan at
// save time) -- this module just aggregates what's already there into a
// suggested per-category monthly budget, the same way a person would if
// they sat down and averaged their last few months of spending by hand.
import type { Transaction } from '@/lib/transactions';

export interface CategorySuggestion {
  label: string;
  /** Average monthly spend in this category across the months analyzed. */
  averageSatang: number;
  /** Number of the analyzed months that had at least one transaction in this category -- low confidence if this is 1 out of e.g. 3 months. */
  monthsWithSpend: number;
  /** Suggested budget amount: the average, rounded up to a friendly amount and padded slightly so a normal month doesn't immediately read as "overspent". */
  suggestedSatang: number;
}

export interface BudgetSuggestion {
  monthsAnalyzed: number;
  totalTransactionsAnalyzed: number;
  categories: CategorySuggestion[];
  /** True when there isn't enough real spending history to suggest anything meaningful. */
  insufficientData: boolean;
}

const MIN_TRANSACTIONS_FOR_SUGGESTION = 5;
// A suggested amount is the average nudged up to this fraction over 100%,
// then rounded to the nearest 50 baht -- a budget set to the exact average
// of past spending would already read as "overspent" about half the time
// even with completely stable habits, which isn't a useful budget.
const SUGGESTION_BUFFER_RATIO = 1.15;
const ROUND_TO_SATANG = 50_00;

function transactionSpendDelta(transaction: Pick<Transaction, 'type' | 'amountSatang'>): number {
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

/**
 * `transactionsByMonth` should be actual, distinct calendar months of
 * history (e.g. the 3 months before the current one -- the current month
 * is deliberately excluded by the caller since it's still in progress and
 * would understate real monthly spend). Categories with no transactions in
 * ANY analyzed month are omitted entirely -- there's nothing to suggest a
 * budget for.
 */
export function suggestBudgetFromHistory(transactionsByMonth: Transaction[][]): BudgetSuggestion {
  const monthsAnalyzed = transactionsByMonth.length;
  const totalTransactionsAnalyzed = transactionsByMonth.reduce((sum, txs) => sum + txs.length, 0);

  // label -> satang spent per month index, so we can both sum (for the
  // average) and count how many distinct months actually had spend in it
  // (for the confidence signal) without a second pass.
  const perMonthByLabel = new Map<string, number[]>();

  transactionsByMonth.forEach((monthTransactions, monthIndex) => {
    for (const tx of monthTransactions) {
      const delta = transactionSpendDelta(tx);
      if (delta === 0) continue;
      const label = tx.categoryLabel?.trim();
      if (!label) continue;

      if (!perMonthByLabel.has(label)) {
        perMonthByLabel.set(label, new Array(monthsAnalyzed).fill(0));
      }
      const perMonth = perMonthByLabel.get(label)!;
      perMonth[monthIndex] += delta;
    }
  });

  const categories: CategorySuggestion[] = [];
  for (const [label, perMonth] of perMonthByLabel.entries()) {
    const total = perMonth.reduce((sum, amount) => sum + Math.max(0, amount), 0);
    if (total <= 0) continue;
    const averageSatang = Math.round(total / monthsAnalyzed);
    const monthsWithSpend = perMonth.filter((amount) => amount > 0).length;
    const padded = Math.round(averageSatang * SUGGESTION_BUFFER_RATIO);
    const suggestedSatang = Math.max(ROUND_TO_SATANG, Math.ceil(padded / ROUND_TO_SATANG) * ROUND_TO_SATANG);
    categories.push({ label, averageSatang, monthsWithSpend, suggestedSatang });
  }

  categories.sort((a, b) => b.averageSatang - a.averageSatang);

  return {
    monthsAnalyzed,
    totalTransactionsAnalyzed,
    categories,
    insufficientData: totalTransactionsAnalyzed < MIN_TRANSACTIONS_FOR_SUGGESTION || categories.length === 0,
  };
}

// --- Income-ratio fallback: for a user with too little (or no) categorized
// spending history to average from (see suggestBudgetFromHistory above).
// Rather than a real Gemini call, this applies common budgeting
// rules-of-thumb (needs ~50% / wants ~30% / savings-debt ~20% of income,
// per widely-cited frameworks like the "50/30/20" rule) as fixed weights
// over this app's own expense category list. It's a generic starting
// point the user is expected to adjust, not a personalized analysis --
// labelled as such in the UI.
//
// Weights are relative shares of the "needs"/"wants" pools (each pool's
// weights sum to 1.0 within that pool), not literal percent-of-income
// values, so NEEDS_RATIO/WANTS_RATIO below can be tuned without having to
// re-balance every individual category weight.
const NEEDS_RATIO = 0.5;
const WANTS_RATIO = 0.3;
// The remaining ~0.2 of income is intentionally left unallocated here --
// that's the "savings/debt" share, and this app already has a much better
// source for the debt portion specifically (the user's real minimum-due
// total) than a generic guess, applied separately below.

const NEEDS_WEIGHTS: Record<string, number> = {
  groceries: 0.28,
  housing: 0.32,
  utilities: 0.12,
  transport: 0.14,
  health: 0.08,
  insurance: 0.06,
};

const WANTS_WEIGHTS: Record<string, number> = {
  food: 0.22,
  shopping: 0.16,
  entertainment: 0.14,
  subscriptions: 0.08,
  personal_care: 0.1,
  fitness: 0.08,
  travel: 0.1,
  family: 0.06,
  gifts: 0.06,
};

export interface RatioCategorySuggestion {
  categoryId: string;
  label: string;
  suggestedSatang: number;
}

export interface IncomeRatioSuggestion {
  needs: RatioCategorySuggestion[];
  wants: RatioCategorySuggestion[];
  insufficientData: boolean;
}

/**
 * Fallback for when suggestBudgetFromHistory has too little real spending
 * history to work from. `incomeSatang` is the user's own planned monthly
 * income (same figure already entered on this page).
 */
export function suggestBudgetFromIncomeRatio(
  incomeSatang: number,
  categoryLabelById: (id: string) => string,
): IncomeRatioSuggestion {
  if (incomeSatang <= 0) {
    return { needs: [], wants: [], insufficientData: true };
  }

  const needsPoolSatang = Math.round(incomeSatang * NEEDS_RATIO);
  const wantsPoolSatang = Math.round(incomeSatang * WANTS_RATIO);

  const toSuggestions = (weights: Record<string, number>, poolSatang: number): RatioCategorySuggestion[] =>
    Object.entries(weights)
      .map(([categoryId, weight]) => ({
        categoryId,
        label: categoryLabelById(categoryId),
        suggestedSatang: Math.max(ROUND_TO_SATANG, Math.round((poolSatang * weight) / ROUND_TO_SATANG) * ROUND_TO_SATANG),
      }))
      .sort((a, b) => b.suggestedSatang - a.suggestedSatang);

  return {
    needs: toSuggestions(NEEDS_WEIGHTS, needsPoolSatang),
    wants: toSuggestions(WANTS_WEIGHTS, wantsPoolSatang),
    insufficientData: false,
  };
}
