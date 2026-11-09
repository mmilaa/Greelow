import { describe, it, expect } from 'vitest';
import {
  summarizeExpenses,
  monthsWithData,
  currenciesWithData,
  accountsWithData,
  type Period,
} from './summarize-expenses';
import { Money } from '../../../shared/domain/money';
import { type Currency } from '../../../shared/domain/currency';
import {
  type Transaction,
  type TransactionType,
  type TransactionStatus,
  type TransactionDirection,
} from '../../../shared/domain/transaction';

const BA = 'America/Argentina/Buenos_Aires';
const ALL: Period = { kind: 'all' };

// Identity-ish label: enough for tie-breaking assertions without shared/ui.
function labelOf(category: string): string {
  const map: Record<string, string> = {
    groceries: 'Supermercado',
    transport: 'Transporte',
    health: 'Salud',
    rent: 'Alquiler',
    other: 'Otros',
  };
  return map[category] ?? category;
}

let seq = 0;
function tx(overrides: Partial<Transaction> & { amount: Money }): Transaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    accountId: 'acc-1',
    type: 'expense' as TransactionType,
    direction: null as TransactionDirection,
    status: 'completed' as TransactionStatus,
    category: 'other',
    description: '',
    counterpartAccountId: null,
    transferId: null,
    createdAt: '2026-10-15T12:00:00Z',
    ...overrides,
  };
}

function expense(
  amount: number,
  currency: Currency,
  category: string,
  createdAt = '2026-10-15T12:00:00Z',
): Transaction {
  return tx({ amount: Money.fromDecimal(amount, currency), category, createdAt });
}

describe('summarizeExpenses', () => {
  it('sums exactly in minor units (0,10 + 0,20 = 30 centavos, no float drift)', () => {
    const txs = [expense(0.1, 'ARS', 'other'), expense(0.2, 'ARS', 'other')];
    const summary = summarizeExpenses(txs, { currency: 'ARS', period: ALL, timeZone: BA, labelOf });
    expect(summary.total.amountMinor).toBe(30);
    expect(summary.categories[0].total.amountMinor).toBe(30);
    expect(summary.categories[0].count).toBe(2);
  });

  it('never mixes currencies: only the chosen currency is summed', () => {
    const txs = [
      expense(100, 'ARS', 'groceries'),
      expense(50, 'USD', 'groceries'),
      expense(25, 'EUR', 'transport'),
    ];
    const summary = summarizeExpenses(txs, { currency: 'ARS', period: ALL, timeZone: BA, labelOf });
    expect(summary.total.currency).toBe('ARS');
    expect(summary.total.amountMinor).toBe(10000);
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0].category).toBe('groceries');
  });

  it('counts only completed expenses: no transfers, incomes, pending or failed', () => {
    const txs = [
      expense(100, 'ARS', 'groceries'), // counts
      tx({ amount: Money.fromDecimal(100, 'ARS'), type: 'income', category: 'salary' }),
      tx({ amount: Money.fromDecimal(100, 'ARS'), type: 'transfer', direction: 'out', category: 'transfer' }),
      tx({ amount: Money.fromDecimal(100, 'ARS'), status: 'pending', category: 'groceries' }),
      tx({ amount: Money.fromDecimal(100, 'ARS'), status: 'failed', category: 'groceries' }),
    ];
    const summary = summarizeExpenses(txs, { currency: 'ARS', period: ALL, timeZone: BA, labelOf });
    expect(summary.total.amountMinor).toBe(10000);
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0].count).toBe(1);
  });

  it('places an expense in the month according to the time zone (02:00Z of Oct 1)', () => {
    // 2026-10-01T02:00:00Z is October in UTC and September in Buenos Aires (UTC-3).
    const txs = [expense(100, 'ARS', 'groceries', '2026-10-01T02:00:00Z')];

    const october = summarizeExpenses(txs, {
      currency: 'ARS',
      period: { kind: 'month', month: '2026-10' },
      timeZone: 'UTC',
      labelOf,
    });
    expect(october.total.amountMinor).toBe(10000);

    const septemberBA = summarizeExpenses(txs, {
      currency: 'ARS',
      period: { kind: 'month', month: '2026-09' },
      timeZone: BA,
      labelOf,
    });
    expect(septemberBA.total.amountMinor).toBe(10000);

    // Same expense is NOT in October under the Buenos Aires zone.
    const octoberBA = summarizeExpenses(txs, {
      currency: 'ARS',
      period: { kind: 'month', month: '2026-10' },
      timeZone: BA,
      labelOf,
    });
    expect(octoberBA.total.amountMinor).toBe(0);
    expect(octoberBA.categories).toHaveLength(0);
  });

  it('orders categories by amount descending and reports shares', () => {
    const txs = [
      expense(100, 'ARS', 'groceries'),
      expense(300, 'ARS', 'rent'),
      expense(200, 'ARS', 'transport'),
    ];
    const summary = summarizeExpenses(txs, { currency: 'ARS', period: ALL, timeZone: BA, labelOf });
    expect(summary.categories.map((c) => c.category)).toEqual(['rent', 'transport', 'groceries']);
    expect(summary.total.amountMinor).toBe(60000);
    expect(summary.categories[0].share).toBeCloseTo(0.5, 10);
    expect(summary.categories[1].share).toBeCloseTo(1 / 3, 10);
  });

  it('breaks an amount tie by the Spanish label', () => {
    // Equal amounts: 'health' -> "Salud", 'groceries' -> "Supermercado",
    // 'transport' -> "Transporte". Alphabetical in Spanish: Salud < Supermercado < Transporte.
    const txs = [
      expense(100, 'ARS', 'transport'),
      expense(100, 'ARS', 'groceries'),
      expense(100, 'ARS', 'health'),
    ];
    const summary = summarizeExpenses(txs, { currency: 'ARS', period: ALL, timeZone: BA, labelOf });
    expect(summary.categories.map((c) => c.category)).toEqual(['health', 'groceries', 'transport']);
  });

  it('returns a zero total and no categories for an empty period', () => {
    const txs = [expense(100, 'ARS', 'groceries', '2026-10-15T12:00:00Z')];
    const summary = summarizeExpenses(txs, {
      currency: 'ARS',
      period: { kind: 'month', month: '2026-01' },
      timeZone: BA,
      labelOf,
    });
    expect(summary.total.amountMinor).toBe(0);
    expect(summary.total.currency).toBe('ARS');
    expect(summary.categories).toHaveLength(0);
  });

  it('restricts to a single account when accountId is given', () => {
    const txs = [
      tx({ amount: Money.fromDecimal(100, 'ARS'), category: 'groceries', accountId: 'acc-1' }),
      tx({ amount: Money.fromDecimal(300, 'ARS'), category: 'rent', accountId: 'acc-2' }),
    ];
    const summary = summarizeExpenses(txs, {
      currency: 'ARS',
      period: ALL,
      accountId: 'acc-1',
      timeZone: BA,
      labelOf,
    });
    expect(summary.total.amountMinor).toBe(10000);
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0].category).toBe('groceries');
  });

  it('includes every account when accountId is null/omitted', () => {
    const txs = [
      tx({ amount: Money.fromDecimal(100, 'ARS'), category: 'groceries', accountId: 'acc-1' }),
      tx({ amount: Money.fromDecimal(300, 'ARS'), category: 'groceries', accountId: 'acc-2' }),
    ];
    const summary = summarizeExpenses(txs, {
      currency: 'ARS',
      period: ALL,
      accountId: null,
      timeZone: BA,
      labelOf,
    });
    expect(summary.total.amountMinor).toBe(40000);
    expect(summary.categories[0].count).toBe(2);
  });
});

describe('currenciesWithData', () => {
  it('lists distinct currencies of spent expenses in first-seen order', () => {
    const txs = [
      expense(100, 'USD', 'groceries'),
      expense(50, 'ARS', 'transport'),
      expense(10, 'USD', 'health'),
    ];
    expect(currenciesWithData(txs)).toEqual(['USD', 'ARS']);
  });

  it('ignores transfers, incomes, pending and failed', () => {
    const txs = [
      tx({ amount: Money.fromDecimal(1, 'USD'), type: 'income', category: 'salary' }),
      tx({ amount: Money.fromDecimal(1, 'EUR'), type: 'transfer', direction: 'out', category: 'transfer' }),
      tx({ amount: Money.fromDecimal(1, 'ARS'), status: 'pending', category: 'groceries' }),
      expense(1, 'ARS', 'groceries'),
    ];
    expect(currenciesWithData(txs)).toEqual(['ARS']);
  });
});

describe('monthsWithData', () => {
  it('lists months of a currency from newest to oldest, in the given zone', () => {
    const txs = [
      expense(1, 'ARS', 'groceries', '2026-08-10T12:00:00Z'),
      expense(1, 'ARS', 'groceries', '2026-10-10T12:00:00Z'),
      expense(1, 'ARS', 'groceries', '2026-09-10T12:00:00Z'),
      expense(1, 'USD', 'groceries', '2026-11-10T12:00:00Z'), // other currency
    ];
    expect(monthsWithData(txs, 'ARS', BA)).toEqual(['2026-10', '2026-09', '2026-08']);
  });

  it('uses the time zone when placing the month (02:00Z of Oct 1 is September in BA)', () => {
    const txs = [expense(1, 'ARS', 'groceries', '2026-10-01T02:00:00Z')];
    expect(monthsWithData(txs, 'ARS', BA)).toEqual(['2026-09']);
    expect(monthsWithData(txs, 'ARS', 'UTC')).toEqual(['2026-10']);
  });

  it('restricts months to a single account when accountId is given', () => {
    const txs = [
      tx({ amount: Money.fromDecimal(1, 'ARS'), category: 'groceries', accountId: 'acc-1', createdAt: '2026-10-10T12:00:00Z' }),
      tx({ amount: Money.fromDecimal(1, 'ARS'), category: 'groceries', accountId: 'acc-2', createdAt: '2026-08-10T12:00:00Z' }),
    ];
    expect(monthsWithData(txs, 'ARS', BA, 'acc-1')).toEqual(['2026-10']);
  });
});

describe('accountsWithData', () => {
  it('lists distinct accounts of spent expenses with their currency, first-seen order', () => {
    const txs = [
      tx({ amount: Money.fromDecimal(1, 'USD'), category: 'groceries', accountId: 'acc-2' }),
      tx({ amount: Money.fromDecimal(1, 'ARS'), category: 'rent', accountId: 'acc-1' }),
      tx({ amount: Money.fromDecimal(1, 'USD'), category: 'health', accountId: 'acc-2' }),
    ];
    expect(accountsWithData(txs)).toEqual([
      { accountId: 'acc-2', currency: 'USD' },
      { accountId: 'acc-1', currency: 'ARS' },
    ]);
  });

  it('ignores transfers, incomes, pending and failed', () => {
    const txs = [
      tx({ amount: Money.fromDecimal(1, 'USD'), type: 'income', category: 'salary', accountId: 'acc-9' }),
      tx({ amount: Money.fromDecimal(1, 'EUR'), type: 'transfer', direction: 'out', category: 'transfer', accountId: 'acc-9' }),
      tx({ amount: Money.fromDecimal(1, 'ARS'), status: 'pending', category: 'groceries', accountId: 'acc-9' }),
      tx({ amount: Money.fromDecimal(1, 'ARS'), category: 'groceries', accountId: 'acc-1' }),
    ];
    expect(accountsWithData(txs)).toEqual([{ accountId: 'acc-1', currency: 'ARS' }]);
  });
});
