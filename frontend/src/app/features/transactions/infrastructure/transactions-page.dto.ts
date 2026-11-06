import { type Transaction } from '../../../shared/domain/transaction';
import { type Page, totalPages } from '../../../shared/domain/page';
import { Money } from '../../../shared/domain/money';
import { InvalidDataError } from '../../../shared/domain/errors';
import { requireNumber } from '../../../shared/domain/parse';
import {
  type TransactionDto,
  mapTransaction,
} from '../../../shared/infrastructure/transaction.dto';

/**
 * Transactions-feature mappers: the paginated list and the create-transaction
 * request. The transaction DTO + mapper itself live in shared/infrastructure
 * because the Transaction entity crosses features.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

export interface PaginationDto {
  page: unknown;
  pageSize: unknown;
  total: unknown;
}

export interface TransactionsPageDto {
  transactions: unknown;
  pagination: unknown;
}

/** Maps a paginated transactions response to a domain Page<Transaction>. */
export function mapTransactionsPage(dto: TransactionsPageDto): Page<Transaction> {
  if (!Array.isArray(dto.transactions)) {
    throw new InvalidDataError('Expected "transactions" to be an array');
  }
  const pagination = dto.pagination as PaginationDto;
  const page = requireNumber(pagination?.page, 'pagination.page');
  const pageSize = requireNumber(pagination?.pageSize, 'pagination.pageSize');
  const total = requireNumber(pagination?.total, 'pagination.total');

  const items = (dto.transactions as TransactionDto[]).map(mapTransaction);
  return { items, page, pageSize, total, totalPages: totalPages(total, pageSize) };
}

// --- request mapper (domain -> API body) --------------------------------

/** Body to create an income/expense transaction. Amount goes back to a decimal. */
export interface CreateTransactionBody {
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  description?: string;
}

export interface CreateTransactionInput {
  accountId: string;
  type: 'income' | 'expense';
  amount: Money;
  category?: string;
  description?: string;
}

/** Maps a create-transaction command to the API request body. */
export function toCreateTransactionBody(input: CreateTransactionInput): CreateTransactionBody {
  const body: CreateTransactionBody = {
    accountId: input.accountId,
    type: input.type,
    amount: input.amount.toDecimal(),
  };
  if (input.category !== undefined) {
    body.category = input.category;
  }
  if (input.description !== undefined) {
    body.description = input.description;
  }
  return body;
}
