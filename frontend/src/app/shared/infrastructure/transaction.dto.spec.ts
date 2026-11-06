import { describe, it, expect } from 'vitest';
import { mapTransaction, type TransactionDto } from './transaction.dto';
import { Money } from '../domain/money';
import { InvalidDataError } from '../domain/errors';

// Fixtures copied from docs/api-samples (03, 04, 10), not imported.
function expenseDto(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: 'txn-10',
    accountId: 'acc-1',
    type: 'expense',
    direction: null,
    amount: 15000,
    currency: 'ARS',
    category: 'health',
    description: 'Farmacia',
    status: 'completed',
    counterpartAccountId: null,
    transferId: null,
    createdAt: '2026-10-20T16:00:00Z',
    ...overrides,
  };
}

function transferLegDto(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: 'transfer-seed-1-out',
    accountId: 'acc-1',
    type: 'transfer',
    direction: 'out',
    amount: 20000,
    currency: 'ARS',
    category: 'transfer',
    description: 'Pago compartido',
    status: 'completed',
    counterpartAccountId: 'acc-4',
    transferId: 'transfer-seed-1',
    createdAt: '2026-10-25T15:00:00Z',
    ...overrides,
  };
}

describe('mapTransaction', () => {
  it('maps an income/expense with null direction', () => {
    const t = mapTransaction(expenseDto());
    expect(t.type).toBe('expense');
    expect(t.direction).toBeNull();
    expect(t.counterpartAccountId).toBeNull();
    expect(t.transferId).toBeNull();
    expect(t.amount.equals(Money.fromDecimal(15000, 'ARS'))).toBe(true);
  });

  it('maps a transfer leg with direction in/out', () => {
    expect(mapTransaction(transferLegDto({ direction: 'out' })).direction).toBe('out');
    expect(mapTransaction(transferLegDto({ direction: 'in' })).direction).toBe('in');
  });

  it('converts a decimal amount to minor units and back (round-trip, case 2)', () => {
    const t = mapTransaction(expenseDto({ amount: 12.34, currency: 'ARS' }));
    expect(t.amount.amountMinor).toBe(1234);
    expect(t.amount.toDecimal()).toBe(12.34);
  });

  it('round-trips a non-round negative amount (case A)', () => {
    const t = mapTransaction(expenseDto({ amount: -169796.34 }));
    expect(t.amount.amountMinor).toBe(-16979634);
    expect(t.amount.toDecimal()).toBe(-169796.34);
  });

  it('maps a failed status even though the seed never produces it', () => {
    expect(mapTransaction(expenseDto({ status: 'failed' })).status).toBe('failed');
  });

  it('respects each item currency', () => {
    expect(mapTransaction(expenseDto({ amount: 440, currency: 'USD' })).amount.currency).toBe('USD');
  });

  describe('normalization of non-monetary fields', () => {
    it('normalizes a missing description to an empty string', () => {
      expect(mapTransaction(expenseDto({ description: undefined })).description).toBe('');
    });

    it('normalizes a missing category to "other"', () => {
      expect(mapTransaction(expenseDto({ category: undefined })).category).toBe('other');
    });
  });

  describe('invalid monetary / structural fields throw', () => {
    it('throws on an unsupported currency (case B)', () => {
      expect(() => mapTransaction(expenseDto({ currency: 'BRL' }))).toThrow(InvalidDataError);
    });

    it('throws on a non-number amount (case C)', () => {
      expect(() => mapTransaction(expenseDto({ amount: '12.34' }))).toThrow(InvalidDataError);
      expect(() => mapTransaction(expenseDto({ amount: null }))).toThrow(InvalidDataError);
    });

    it('throws on a type out of the union (case D)', () => {
      expect(() => mapTransaction(expenseDto({ type: 'withdrawal' }))).toThrow(InvalidDataError);
    });

    it('throws on a status out of the union (case D)', () => {
      expect(() => mapTransaction(expenseDto({ status: 'cancelled' }))).toThrow(InvalidDataError);
    });

    it('throws on a direction out of the union', () => {
      expect(() => mapTransaction(transferLegDto({ direction: 'sideways' }))).toThrow(InvalidDataError);
    });

    it('throws when id is missing', () => {
      expect(() => mapTransaction(expenseDto({ id: undefined }))).toThrow(InvalidDataError);
    });
  });

  describe('direction / type coherence', () => {
    it('throws when a transfer has null direction', () => {
      expect(() => mapTransaction(transferLegDto({ type: 'transfer', direction: null }))).toThrow(
        InvalidDataError,
      );
    });

    it('throws when an income has a direction', () => {
      expect(() => mapTransaction(expenseDto({ type: 'income', direction: 'in' }))).toThrow(
        InvalidDataError,
      );
    });

    it('throws when an expense has a direction', () => {
      expect(() => mapTransaction(expenseDto({ type: 'expense', direction: 'out' }))).toThrow(
        InvalidDataError,
      );
    });
  });
});
