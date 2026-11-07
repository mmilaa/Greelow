import { Injectable, computed, inject, signal } from '@angular/core';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { type Transaction } from '../../../shared/domain/transaction';
import { totalPages } from '../../../shared/domain/page';
import {
  type TransactionFilter,
  filterToQuery,
  hasActiveFilters,
} from '../domain/transaction-filter';

/** State of the listing area (not the filters, which live in the URL). */
export type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'empty';
      filtered: boolean;
      /** Echoed pagination so the page can detect an out-of-range request. */
      total: number;
      page: number;
      pageSize: number;
    }
  | {
      status: 'ready';
      items: Transaction[];
      total: number;
      totalPages: number;
      /** Echoed back so the UI can detect an out-of-range page. */
      page: number;
      pageSize: number;
    };

/**
 * Store for the transactions listing. Each distinct filter is one query; a
 * stale response never overwrites a newer one (generation counter, checked
 * after every await and before any state change, including failures). A query
 * identical to the last SUCCESSFUL one is skipped unless forced (Actualizar);
 * a failed query is always retried.
 *
 * Signals + inject (allowed in application); no browser, HTTP or Router.
 */
@Injectable()
export class TransactionsStore {
  private readonly transactions = inject(TransactionPort);

  private readonly stateSig = signal<ListState>({ status: 'loading' });
  private generation = 0;
  /** Serialized query of the last SUCCESSFUL load, for deduping. */
  private lastLoadedKey: string | null = null;

  readonly state = this.stateSig.asReadonly();
  readonly resultCount = computed<number | null>(() => {
    const s = this.stateSig();
    if (s.status === 'ready') return s.total;
    if (s.status === 'empty') return 0;
    return null;
  });

  /**
   * Loads the given filter. Skips the request when the resulting query equals
   * the last successful one, unless `force` is true. Returns when settled.
   */
  async load(filter: TransactionFilter, force = false): Promise<void> {
    const query = filterToQuery(filter);
    const key = JSON.stringify(query);
    if (!force && key === this.lastLoadedKey) {
      return; // identical to the last successful load: no-op
    }

    const gen = ++this.generation;
    this.stateSig.set({ status: 'loading' });

    let page;
    try {
      page = await this.transactions.list(query);
    } catch {
      if (gen !== this.generation) return; // a newer load started
      this.stateSig.set({ status: 'error' });
      return;
    }
    if (gen !== this.generation) return; // check before any state change

    this.lastLoadedKey = key;
    if (page.items.length === 0) {
      this.stateSig.set({
        status: 'empty',
        filtered: hasActiveFilters(filter),
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      });
      return;
    }
    this.stateSig.set({
      status: 'ready',
      items: page.items,
      total: page.total,
      totalPages: totalPages(page.total, page.pageSize),
      page: page.page,
      pageSize: page.pageSize,
    });
  }
}
