import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  TransferPort,
  type CreateTransferInput,
} from '../application/transfer.port';
import { type Transfer } from '../domain/transfer';
import { type AccountTransaction } from '../domain/transfer-policy';
import { mapTransfer, toCreateTransferBody, type TransferDto } from './transfer.dto';
import { mapTransaction, type TransactionDto } from '../../../shared/infrastructure/transaction.dto';
import { type TransactionsPageDto } from '../../transactions/infrastructure/transactions-page.dto';
import { API_BASE_URL } from '../../../core/config/api.config';
import { runRequest } from '../../../core/http/http-adapter.util';
import { ApiErrorException } from '../../../shared/domain/map-api-error';

/** Page size used when fetching pending outgoing transfers. */
const PENDING_PAGE_SIZE = 50;
/** Hard cap on pages fetched, to avoid looping on a corrupt `total`. */
const MAX_PENDING_PAGES = 20;

/** HTTP adapter for transfers. */
@Injectable()
export class TransferHttpAdapter extends TransferPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  override create(input: CreateTransferInput): Promise<Transfer> {
    return runRequest(
      this.http.post<TransferDto>(`${this.baseUrl}/transfers`, toCreateTransferBody(input)),
      'create-transfer',
      (raw) => mapTransfer(raw),
    );
  }

  override getById(id: string): Promise<Transfer> {
    return runRequest(
      this.http.get<TransferDto>(`${this.baseUrl}/transfers/${id}`),
      'read',
      (raw) => mapTransfer(raw),
    );
  }

  /**
   * Fetches every page of outgoing pending transfers for an account and maps
   * them to AccountTransaction. Fetches all pages (cap MAX_PENDING_PAGES); if
   * any page fails, it throws and never returns a partial list.
   */
  override async pendingOutgoing(accountId: string): Promise<AccountTransaction[]> {
    const items: AccountTransaction[] = [];
    let page = 1;
    let total = Infinity;

    while (items.length < total) {
      if (page > MAX_PENDING_PAGES) {
        throw new ApiErrorException(
          { kind: 'invalid-response' },
          {
            cause: new Error(
              `Too many pending transfers for account ${accountId} (exceeded ${MAX_PENDING_PAGES} pages)`,
            ),
          },
        );
      }
      const pageResult = await this.fetchPendingPage(accountId, page);
      total = pageResult.total;
      items.push(...pageResult.items);
      if (pageResult.items.length === 0) {
        break; // defensive: stop if a page returns nothing
      }
      page += 1;
    }

    return items;
  }

  private fetchPendingPage(
    accountId: string,
    page: number,
  ): Promise<{ items: AccountTransaction[]; total: number }> {
    const params = new HttpParams()
      .set('accountId', accountId)
      .set('status', 'pending')
      .set('type', 'transfer')
      .set('page', String(page))
      .set('pageSize', String(PENDING_PAGE_SIZE));

    return runRequest(
      this.http.get<TransactionsPageDto>(`${this.baseUrl}/transactions`, { params }),
      'read',
      (raw) => {
        const dtos = raw.transactions as TransactionDto[];
        const items: AccountTransaction[] = dtos.map((dto) => {
          const t = mapTransaction(dto);
          return {
            accountId: t.accountId,
            direction: t.direction,
            status: t.status,
            amount: t.amount,
          };
        });
        const total = (raw.pagination as { total: number }).total;
        return { items, total };
      },
    );
  }
}
