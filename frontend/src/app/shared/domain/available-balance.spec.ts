import { describe, it, expect } from 'vitest';
import { availableBalance, type AccountTransaction } from './available-balance';
import { Money } from './money';
import { CurrencyMismatchError } from './errors';

function ars(amount: number): Money {
  return Money.fromDecimal(amount, 'ARS');
}

function usd(amount: number): Money {
  return Money.fromDecimal(amount, 'USD');
}

/** Builds a transaction, defaulting to an outgoing pending transfer (the kind that reserves funds). */
function transaction(overrides: Partial<AccountTransaction> = {}): AccountTransaction {
  return {
    accountId: 'acc-1',
    direction: 'out',
    status: 'pending',
    amount: ars(1000),
    ...overrides,
  };
}

describe('availableBalance', () => {
  it('equals the ledger balance when there are no transactions', () => {
    const result = availableBalance(ars(100000), 'acc-1', []);
    expect(result.equals(ars(100000))).toBe(true);
  });

  it('subtracts a single outgoing pending transfer from the ledger balance', () => {
    const transactions = [transaction({ direction: 'out', status: 'pending', amount: ars(30000) })];
    const result = availableBalance(ars(100000), 'acc-1', transactions);
    expect(result.equals(ars(70000))).toBe(true);
  });

  it('accumulates multiple outgoing pending transfers', () => {
    const transactions = [
      transaction({ amount: ars(20000) }),
      transaction({ amount: ars(15000) }),
    ];
    const result = availableBalance(ars(100000), 'acc-1', transactions);
    expect(result.equals(ars(65000))).toBe(true);
  });

  it('ignores incoming pending transfers (direction "in")', () => {
    const transactions = [transaction({ direction: 'in', status: 'pending', amount: ars(40000) })];
    const result = availableBalance(ars(100000), 'acc-1', transactions);
    expect(result.equals(ars(100000))).toBe(true);
  });

  it('ignores completed and failed transfers', () => {
    const transactions = [
      transaction({ status: 'completed', amount: ars(30000) }),
      transaction({ status: 'failed', amount: ars(25000) }),
    ];
    const result = availableBalance(ars(100000), 'acc-1', transactions);
    expect(result.equals(ars(100000))).toBe(true);
  });

  it('ignores outgoing pending transfers from a different account', () => {
    const transactions = [transaction({ accountId: 'acc-9', amount: ars(50000) })];
    const result = availableBalance(ars(100000), 'acc-1', transactions);
    expect(result.equals(ars(100000))).toBe(true);
  });

  it('can produce a negative available balance (pending larger than the ledger balance)', () => {
    const transactions = [transaction({ amount: ars(150000) })];
    const result = availableBalance(ars(100000), 'acc-1', transactions);
    expect(result.equals(ars(-50000))).toBe(true);
  });

  it('ignores a pending transaction with null direction (income/expense are never reservations)', () => {
    const transactions = [transaction({ direction: null, status: 'pending', amount: ars(40000) })];
    const result = availableBalance(ars(100000), 'acc-1', transactions);
    expect(result.equals(ars(100000))).toBe(true);
  });

  it('throws CurrencyMismatchError when a reserving transaction is in another currency', () => {
    // A pending outgoing transaction in a different currency than the balance is a
    // data bug; Money arithmetic surfaces it rather than silently skipping it.
    const transactions = [transaction({ direction: 'out', status: 'pending', amount: usd(100) })];
    expect(() => availableBalance(ars(100000), 'acc-1', transactions)).toThrow(CurrencyMismatchError);
  });
});
