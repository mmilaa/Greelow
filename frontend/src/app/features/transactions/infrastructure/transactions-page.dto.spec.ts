import { describe, it, expect } from 'vitest';
import {
  mapTransactionsPage,
  toCreateTransactionBody,
  type TransactionsPageDto,
} from './transactions-page.dto';
import { type TransactionDto } from '../../../shared/infrastructure/transaction.dto';
import { Money } from '../../../shared/domain/money';
import { InvalidDataError } from '../../../shared/domain/errors';

// Fixtures copied from docs/api-samples (03, 21), not imported.
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

describe('mapTransactionsPage', () => {
  it('maps items and preserves page/pageSize/total (case H)', () => {
    const dto: TransactionsPageDto = {
      transactions: [expenseDto(), expenseDto({ id: 'txn-9' })],
      pagination: { page: 1, pageSize: 5, total: 13 },
    };
    const page = mapTransactionsPage(dto);
    expect(page.items).toHaveLength(2);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(5);
    expect(page.total).toBe(13);
    expect(page.totalPages).toBe(3);
  });

  it('maps an empty list to an empty page, not an error (sample 21)', () => {
    const dto: TransactionsPageDto = {
      transactions: [],
      pagination: { page: 1, pageSize: 10, total: 0 },
    };
    const page = mapTransactionsPage(dto);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    expect(page.totalPages).toBe(0);
  });

  it('maps a list mixing currencies, respecting each item (case I)', () => {
    const dto: TransactionsPageDto = {
      transactions: [
        expenseDto({ id: 't1', amount: 100, currency: 'ARS' }),
        expenseDto({ id: 't2', amount: 50, currency: 'USD' }),
      ],
      pagination: { page: 1, pageSize: 10, total: 2 },
    };
    const page = mapTransactionsPage(dto);
    expect(page.items[0].amount.currency).toBe('ARS');
    expect(page.items[1].amount.currency).toBe('USD');
  });

  it('throws if a single item is invalid (no silent drop)', () => {
    const dto: TransactionsPageDto = {
      transactions: [expenseDto(), expenseDto({ currency: 'BRL' })],
      pagination: { page: 1, pageSize: 10, total: 2 },
    };
    expect(() => mapTransactionsPage(dto)).toThrow(InvalidDataError);
  });

  it('throws InvalidDataError when the response has no pagination', () => {
    const dto = { transactions: [expenseDto()] } as unknown as TransactionsPageDto;
    expect(() => mapTransactionsPage(dto)).toThrow(InvalidDataError);
  });
});

describe('toCreateTransactionBody', () => {
  it('maps a command to the API body with a decimal amount', () => {
    const body = toCreateTransactionBody({
      accountId: 'acc-1',
      type: 'expense',
      amount: Money.fromDecimal(5000, 'ARS'),
      category: 'groceries',
      description: 'Supermercado',
    });
    expect(body).toEqual({
      accountId: 'acc-1',
      type: 'expense',
      amount: 5000,
      category: 'groceries',
      description: 'Supermercado',
    });
  });

  it('converts minor units back to a decimal amount', () => {
    const body = toCreateTransactionBody({
      accountId: 'acc-1',
      type: 'income',
      amount: Money.fromMinor(1234, 'ARS'),
    });
    expect(body.amount).toBe(12.34);
  });

  it('omits optional fields when not provided', () => {
    const body = toCreateTransactionBody({
      accountId: 'acc-1',
      type: 'income',
      amount: Money.fromDecimal(100, 'ARS'),
    });
    expect(body).toEqual({ accountId: 'acc-1', type: 'income', amount: 100 });
  });
});
