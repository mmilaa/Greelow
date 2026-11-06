import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  TransactionPort,
  CategoryPort,
  type TransactionQuery,
  type CreateTransactionInput,
} from '../application/transaction.port';
import { type Transaction } from '../../../shared/domain/transaction';
import { type Page } from '../../../shared/domain/page';
import { type TransactionDto } from '../../../shared/infrastructure/transaction.dto';
import { mapTransaction } from '../../../shared/infrastructure/transaction.dto';
import {
  mapTransactionsPage,
  toCreateTransactionBody,
  type TransactionsPageDto,
} from './transactions-page.dto';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiRequestRunner } from '../../../core/http/api-request-runner';

/** Builds HttpParams from a query, omitting undefined fields. */
function toParams(query: TransactionQuery): HttpParams {
  let params = new HttpParams();
  const entries: [string, string | number | undefined][] = [
    ['accountId', query.accountId],
    ['type', query.type],
    ['category', query.category],
    ['status', query.status],
    ['search', query.search],
    ['page', query.page],
    ['pageSize', query.pageSize],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined) {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** HTTP adapter for transactions. */
@Injectable()
export class TransactionHttpAdapter extends TransactionPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly runner = inject(ApiRequestRunner);

  override list(query: TransactionQuery): Promise<Page<Transaction>> {
    return this.runner.run(
      this.http.get<TransactionsPageDto>(`${this.baseUrl}/transactions`, {
        params: toParams(query),
      }),
      'read',
      (raw) => mapTransactionsPage(raw),
    );
  }

  override create(input: CreateTransactionInput): Promise<Transaction> {
    return this.runner.run(
      this.http.post<TransactionDto>(
        `${this.baseUrl}/transactions`,
        toCreateTransactionBody(input),
      ),
      'create-transaction',
      (raw) => mapTransaction(raw),
    );
  }
}

/** HTTP adapter for categories. */
@Injectable()
export class CategoryHttpAdapter extends CategoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly runner = inject(ApiRequestRunner);

  override list(): Promise<string[]> {
    return this.runner.run(
      this.http.get<{ categories: string[] }>(`${this.baseUrl}/categories`),
      'read',
      (raw) => raw.categories,
    );
  }
}
