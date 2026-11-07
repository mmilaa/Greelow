import { describe, it, expect } from 'vitest';
import { signedAmount } from './signed-amount';
import { Money } from './money';
import { type Transaction } from './transaction';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    type: 'expense',
    direction: null,
    status: 'completed',
    amount: Money.fromDecimal(100, 'ARS'),
    category: 'other',
    description: '',
    counterpartAccountId: null,
    transferId: null,
    createdAt: '2026-10-20T16:00:00Z',
    ...overrides,
  };
}

describe('signedAmount', () => {
  it('income is positive', () => {
    const result = signedAmount(tx({ type: 'income', direction: null, amount: Money.fromDecimal(100, 'ARS') }));
    expect(result.equals(Money.fromDecimal(100, 'ARS'))).toBe(true);
    expect(result.isNegative()).toBe(false);
  });

  it('expense is negative', () => {
    const result = signedAmount(tx({ type: 'expense', direction: null, amount: Money.fromDecimal(100, 'ARS') }));
    expect(result.equals(Money.fromDecimal(-100, 'ARS'))).toBe(true);
    expect(result.isNegative()).toBe(true);
  });

  it('a transfer leg with direction "in" is positive', () => {
    const result = signedAmount(tx({ type: 'transfer', direction: 'in', amount: Money.fromDecimal(500, 'ARS') }));
    expect(result.equals(Money.fromDecimal(500, 'ARS'))).toBe(true);
  });

  it('a transfer leg with direction "out" is negative', () => {
    const result = signedAmount(tx({ type: 'transfer', direction: 'out', amount: Money.fromDecimal(500, 'ARS') }));
    expect(result.equals(Money.fromDecimal(-500, 'ARS'))).toBe(true);
  });

  it('does not depend on the status (a failed/pending out is still negative)', () => {
    const failed = signedAmount(tx({ type: 'transfer', direction: 'out', status: 'failed', amount: Money.fromDecimal(500, 'ARS') }));
    const pending = signedAmount(tx({ type: 'transfer', direction: 'out', status: 'pending', amount: Money.fromDecimal(500, 'ARS') }));
    expect(failed.equals(Money.fromDecimal(-500, 'ARS'))).toBe(true);
    expect(pending.equals(Money.fromDecimal(-500, 'ARS'))).toBe(true);
  });

  it('preserves the currency', () => {
    expect(signedAmount(tx({ type: 'expense', amount: Money.fromDecimal(10, 'USD') })).currency).toBe('USD');
  });
});
