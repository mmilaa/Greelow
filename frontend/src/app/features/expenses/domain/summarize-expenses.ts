import { type Transaction } from '../../../shared/domain/transaction';
import { type Currency } from '../../../shared/domain/currency';
import { Money } from '../../../shared/domain/money';

/**
 * Expense summary by category, decided entirely in the domain (pure TypeScript,
 * no `@angular/*`, no HTTP). The important part is money: sums are exact (minor
 * units via Money.plus) and currencies are never mixed.
 *
 * What counts as a spent expense (the one rule that matters): type 'expense'
 * AND status 'completed'. A transfer is never an expense (even an outgoing one);
 * a pending or failed expense did not move money. The query already filters, but
 * the domain filters again so it is correct on its own.
 */

/** The period to summarize: the whole history, or a single calendar month. */
export type Period =
  | { kind: 'all' }
  | { kind: 'month'; month: MonthKey };

/** A calendar month as "YYYY-MM", computed in a given time zone (not UTC). */
export type MonthKey = string;

/** One category line of the summary. */
export interface CategorySummary {
  /** The raw category code (e.g. 'groceries'). The label is produced by the UI. */
  category: string;
  /** Total spent in this category, as Money (never mixes currencies). */
  total: Money;
  /** How many expenses fell in this category. */
  count: number;
  /** Share of the period total, 0..1, for the decorative bar width only. */
  share: number;
}

export interface ExpenseSummary {
  currency: Currency;
  period: Period;
  /** Total spent in the period, as Money. Zero when the period is empty. */
  total: Money;
  /** Category lines, from the largest amount to the smallest. */
  categories: CategorySummary[];
}

export interface SummarizeOptions {
  currency: Currency;
  period: Period;
  /**
   * Restrict to a single account. When omitted (or null), every account of the
   * chosen currency is included. An account has one currency, so filtering by
   * account never risks mixing currencies.
   */
  accountId?: string | null;
  /** The browser's time zone, used to place each expense in a calendar month. */
  timeZone: string;
  /**
   * Spanish label for a category, used ONLY to break ties deterministically.
   * The domain cannot import from shared/ui, so the label comes in as a param.
   */
  labelOf: (category: string) => string;
}

/** An account that appears in the spent expenses, with its (single) currency. */
export interface AccountWithData {
  accountId: string;
  currency: Currency;
}

/** True for a spent expense: type 'expense' and status 'completed'. */
function isSpentExpense(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.status === 'completed';
}

/**
 * The calendar month ("YYYY-MM") of an ISO timestamp in a given time zone.
 * Uses Intl.DateTimeFormat with the zone (NOT Date.getMonth(), which would use
 * the runtime zone): 2026-10-01T02:00:00Z is October in UTC but September in
 * America/Argentina/Buenos_Aires.
 */
export function monthKeyOf(iso: string, timeZone: string): MonthKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

/** True when the expense belongs to the period (always true for 'all'). */
function inPeriod(tx: Transaction, period: Period, timeZone: string): boolean {
  if (period.kind === 'all') {
    return true;
  }
  return monthKeyOf(tx.createdAt, timeZone) === period.month;
}

/**
 * The distinct currencies that appear in the spent expenses, in first-seen
 * order (so the selector lists only currencies the user actually spent in).
 */
export function currenciesWithData(transactions: readonly Transaction[]): Currency[] {
  const seen: Currency[] = [];
  for (const tx of transactions) {
    if (!isSpentExpense(tx)) continue;
    const currency = tx.amount.currency;
    if (!seen.includes(currency)) {
      seen.push(currency);
    }
  }
  return seen;
}

/**
 * The accounts that appear in the spent expenses, in first-seen order, each with
 * its single currency. Lets the UI build an account selector without a separate
 * read: the accounts are derived from the expenses themselves.
 */
export function accountsWithData(transactions: readonly Transaction[]): AccountWithData[] {
  const seen: AccountWithData[] = [];
  const ids = new Set<string>();
  for (const tx of transactions) {
    if (!isSpentExpense(tx)) continue;
    if (ids.has(tx.accountId)) continue;
    ids.add(tx.accountId);
    seen.push({ accountId: tx.accountId, currency: tx.amount.currency });
  }
  return seen;
}

/**
 * The months (for a currency, optionally a single account) that have at least
 * one spent expense, as "YYYY-MM" keys, from the most recent to the oldest.
 * Months come from the data, computed in the given time zone.
 */
export function monthsWithData(
  transactions: readonly Transaction[],
  currency: Currency,
  timeZone: string,
  accountId?: string | null,
): MonthKey[] {
  const seen = new Set<MonthKey>();
  for (const tx of transactions) {
    if (!isSpentExpense(tx)) continue;
    if (tx.amount.currency !== currency) continue;
    if (accountId != null && tx.accountId !== accountId) continue;
    seen.add(monthKeyOf(tx.createdAt, timeZone));
  }
  // Lexicographic order on "YYYY-MM" is chronological; reverse for newest first.
  return [...seen].sort().reverse();
}

/**
 * Summarizes the spent expenses of ONE currency for a period, optionally of a
 * single account. Filters again by type/status/currency/account/period, groups
 * by category, sums with Money.plus (exact minor units), and sorts by amount
 * descending, breaking ties by the Spanish label (so the order is stable and
 * reads naturally). Never mixes currencies.
 */
export function summarizeExpenses(
  transactions: readonly Transaction[],
  { currency, period, accountId, timeZone, labelOf }: SummarizeOptions,
): ExpenseSummary {
  const byCategory = new Map<string, { total: Money; count: number }>();
  let total = Money.zero(currency);

  for (const tx of transactions) {
    if (!isSpentExpense(tx)) continue;
    if (tx.amount.currency !== currency) continue;
    if (accountId != null && tx.accountId !== accountId) continue;
    if (!inPeriod(tx, period, timeZone)) continue;

    total = total.plus(tx.amount); // same currency guaranteed above
    const current = byCategory.get(tx.category);
    if (current) {
      current.total = current.total.plus(tx.amount);
      current.count += 1;
    } else {
      byCategory.set(tx.category, { total: tx.amount, count: 1 });
    }
  }

  const totalMinor = total.amountMinor;
  const categories: CategorySummary[] = [...byCategory.entries()]
    .map(([category, { total: catTotal, count }]) => ({
      category,
      total: catTotal,
      count,
      share: totalMinor === 0 ? 0 : catTotal.amountMinor / totalMinor,
    }))
    .sort((a, b) => {
      // Largest amount first.
      if (a.total.amountMinor !== b.total.amountMinor) {
        return b.total.amountMinor - a.total.amountMinor;
      }
      // Tie: by the Spanish label, so the order is deterministic and readable.
      return labelOf(a.category).localeCompare(labelOf(b.category), 'es');
    });

  return { currency, period, total, categories };
}
