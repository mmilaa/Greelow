import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PendingTransfersPort } from '../../shared/application/pending-transfers.port';
import { type AccountTransaction } from '../../shared/domain/available-balance';
import { mapTransaction, type TransactionDto } from '../../shared/infrastructure/transaction.dto';
import { API_BASE_URL } from '../config/api.config';
import { ApiRequestRunner } from '../http/api-request-runner';
import { ApiErrorException } from '../../shared/domain/map-api-error';

interface PageDto {
  transactions: unknown;
  pagination: unknown;
}

const PENDING_PAGE_SIZE = 50;
/** Hard cap on pages fetched, to avoid looping on a corrupt `total`. */
const MAX_PENDING_PAGES = 20;

/**
 * Fetches ALL of the user's outgoing pending transfers (no accountId filter),
 * paging through every page. Lives in core (not shared) because it uses core's
 * ApiRequestRunner and API_BASE_URL, and shared may not depend on core.
 *
 * Fetches all pages (cap MAX_PENDING_PAGES); if any page fails it throws and
 * never returns a partial list.
 */
@Injectable()
export class PendingTransfersHttpAdapter extends PendingTransfersPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly runner = inject(ApiRequestRunner);

  override async pendingOutgoing(): Promise<AccountTransaction[]> {
    const items: AccountTransaction[] = [];
    let page = 1;
    let total = Infinity;

    while (items.length < total) {
      if (page > MAX_PENDING_PAGES) {
        throw new ApiErrorException(
          { kind: 'invalid-response' },
          {
            cause: new Error(
              `Too many pending transfers (exceeded ${MAX_PENDING_PAGES} pages)`,
            ),
          },
        );
      }
      const pageResult = await this.fetchPage(page);
      total = pageResult.total;
      items.push(...pageResult.items);
      if (pageResult.items.length === 0) {
        break; // defensive: stop if a page returns nothing
      }
      page += 1;
    }

    return items;
  }

  private fetchPage(page: number): Promise<{ items: AccountTransaction[]; total: number }> {
    const params = new HttpParams()
      .set('status', 'pending')
      .set('type', 'transfer')
      .set('page', String(page))
      .set('pageSize', String(PENDING_PAGE_SIZE));

    return this.runner.run(
      this.http.get<PageDto>(`${this.baseUrl}/transactions`, { params }),
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
