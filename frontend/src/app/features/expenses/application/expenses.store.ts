import { Injectable, computed, inject, signal } from '@angular/core';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { type Transaction } from '../../../shared/domain/transaction';
import { totalPages } from '../../../shared/domain/page';

/**
 * Loads every completed expense once (all pages, in sequence) and keeps the raw
 * list. The period and currency are view state derived from that list, so
 * changing either does NOT trigger a new read (the page computes the summary
 * from `transactions()`).
 *
 * Uses signals and inject (allowed in application). No HTTP, Router, RxJS or
 * browser APIs here: the port does the HTTP, the page passes the time zone.
 *
 * A generation counter makes a late response never overwrite a newer one; it is
 * checked right after every await, including on failure. Never produces a
 * partial summary: if the page cap is exceeded or any page fails, the state is
 * 'error' and no transactions are exposed.
 */

const PAGE_SIZE = 50;
const MAX_PAGES = 20;

export type ExpensesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; transactions: Transaction[] };

@Injectable()
export class ExpensesStore {
  private readonly transactionPort = inject(TransactionPort);

  private readonly stateSig = signal<ExpensesState>({ status: 'loading' });
  private readonly refreshingSig = signal(false);
  private generation = 0;

  readonly state = this.stateSig.asReadonly();
  readonly refreshing = this.refreshingSig.asReadonly();

  /** The loaded completed expenses, or [] until ready. */
  readonly transactions = computed<Transaction[]>(() => {
    const s = this.stateSig();
    return s.status === 'ready' ? s.transactions : [];
  });

  private hasData(): boolean {
    return this.stateSig().status === 'ready';
  }

  /** First load (or retry from error): shows the loading panel if there is no data. */
  load(): Promise<void> {
    return this.run(false);
  }

  /** Refresh: keeps the current data visible with an indicator. */
  refresh(): Promise<void> {
    return this.run(true);
  }

  private run(isRefresh: boolean): Promise<void> {
    const gen = ++this.generation;

    if (isRefresh && this.hasData()) {
      this.refreshingSig.set(true);
    } else {
      this.stateSig.set({ status: 'loading' });
    }

    return this.readAll(gen)
      .then((items) => {
        if (gen !== this.generation) return; // a newer load started: discard
        if (items === null) {
          // Cap exceeded or a page failed: never a partial summary.
          this.fail(gen);
          return;
        }
        this.stateSig.set({ status: 'ready', transactions: items });
        this.stopRefreshing(gen);
      })
      .catch(() => {
        if (gen !== this.generation) return;
        this.fail(gen);
      });
  }

  /**
   * Reads all completed-expense pages in sequence. Returns the full list, or
   * null when the cap is exceeded or a page fails (the caller turns that into an
   * error with no data). The generation is checked after every await.
   */
  private async readAll(gen: number): Promise<Transaction[] | null> {
    const items: Transaction[] = [];
    let page = 1;

    while (page <= MAX_PAGES) {
      let total: number;
      try {
        const result = await this.transactionPort.list({
          type: 'expense',
          status: 'completed',
          page,
          pageSize: PAGE_SIZE,
        });
        if (gen !== this.generation) return null; // superseded: caller discards
        items.push(...result.items);
        total = result.total;
      } catch {
        return null; // a page failed -> no partial summary
      }

      const pages = totalPages(total, PAGE_SIZE);
      if (page >= pages) {
        return items; // last page read
      }
      page += 1;
    }

    // We hit the cap with more pages still to read: refuse a partial summary.
    return null;
  }

  private fail(gen: number): void {
    this.stateSig.set({ status: 'error' });
    this.stopRefreshing(gen);
  }

  private stopRefreshing(gen: number): void {
    if (gen === this.generation) {
      this.refreshingSig.set(false);
    }
  }
}
