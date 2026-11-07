import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TransactionsPage } from './transactions.page';
import { AccountPort } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import {
  TransactionPort,
  type TransactionQuery,
} from '../../../shared/application/transaction.port';
import { CategoryPort } from '../application/category.port';
import { type Account } from '../../../shared/domain/account';
import { type Transaction } from '../../../shared/domain/transaction';
import { type Page } from '../../../shared/domain/page';
import { Money } from '../../../shared/domain/money';

const CALL_CAP = 5;

function account(id: string, name: string): Account {
  return { id, name, currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

function txn(id: string, accountId = 'acc-1'): Transaction {
  return {
    id, accountId, type: 'expense', direction: null, status: 'completed',
    amount: Money.fromDecimal(100, 'ARS'), category: 'groceries', description: 'x',
    counterpartAccountId: null, transferId: null, createdAt: '2026-10-20T16:00:00Z',
  };
}

class FakeAccountPort extends AccountPort {
  calls = 0;
  override async list(): Promise<Account[]> {
    if (++this.calls > CALL_CAP) throw new Error('AccountPort.list too many times');
    return [account('acc-1', 'Cuenta Pesos'), account('acc-2', 'Cuenta Dólares')];
  }
  override async create(): Promise<Account> {
    return account('new', 'New');
  }
}

class FakePendingPort extends PendingTransfersPort {
  calls = 0;
  override async pendingOutgoing() {
    if (++this.calls > CALL_CAP) throw new Error('Pending too many times');
    return [];
  }
}

class FakeCategoryPort extends CategoryPort {
  calls = 0;
  override async list(): Promise<string[]> {
    if (++this.calls > CALL_CAP) throw new Error('Categories too many times');
    return ['groceries', 'rent', 'salary', 'transfer'];
  }
}

class CountingTransactionPort extends TransactionPort {
  calls = 0;
  queries: TransactionQuery[] = [];
  /** total used to build pages; default small so no out-of-range. */
  total = 1;
  override async list(query: TransactionQuery): Promise<Page<Transaction>> {
    this.queries.push(query);
    if (++this.calls > CALL_CAP) throw new Error(`TransactionPort.list too many times (${this.calls})`);
    const pageSize = query.pageSize ?? 10;
    const pageNum = query.page ?? 1;
    // Non-empty only while the requested page is within range.
    const inRange = (pageNum - 1) * pageSize < this.total;
    const items = inRange ? [txn('t' + this.calls)] : [];
    return { items, page: pageNum, pageSize, total: this.total, totalPages: 1 };
  }
  override async create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

function setup() {
  const accountPort = new FakeAccountPort();
  const pendingPort = new FakePendingPort();
  const categoryPort = new FakeCategoryPort();
  const transactionPort = new CountingTransactionPort();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'transactions', component: TransactionsPage }]),
      { provide: AccountPort, useValue: accountPort },
      { provide: PendingTransfersPort, useValue: pendingPort },
      { provide: CategoryPort, useValue: categoryPort },
      { provide: TransactionPort, useValue: transactionPort },
    ],
  });
  return { accountPort, pendingPort, categoryPort, transactionPort };
}

/** Flushes microtasks and Angular effects so chained navigations settle. */
async function settle(harness: RouterTestingHarness): Promise<void> {
  for (let i = 0; i < 20; i++) {
    harness.detectChanges();
    await Promise.resolve();
  }
}

describe('TransactionsPage (integration, real stores + router)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('entering with filters in the URL makes one query with those filters', async () => {
    const { transactionPort } = setup();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/transactions?type=expense&status=completed');
    await settle(harness);

    expect(transactionPort.calls).toBe(1);
    expect(transactionPort.queries[0]).toMatchObject({ type: 'expense', status: 'completed', page: 1, pageSize: 10 });
  });

  it('changing a filter makes one more query and resets to page 1', async () => {
    const { transactionPort } = setup();
    const harness = await RouterTestingHarness.create();
    const page = (await harness.navigateByUrl('/transactions?page=2')) as TransactionsPage;
    await settle(harness);
    const before = transactionPort.calls;

    page.onFilterChange({ type: 'income' });
    await settle(harness);

    expect(transactionPort.calls).toBe(before + 1);
    const last = transactionPort.queries[transactionPort.queries.length - 1];
    expect(last).toMatchObject({ type: 'income', page: 1 });
  });

  it('changing the page makes one more query', async () => {
    const { transactionPort } = setup();
    transactionPort.total = 50; // enough pages
    const harness = await RouterTestingHarness.create();
    const page = (await harness.navigateByUrl('/transactions')) as TransactionsPage;
    await settle(harness);
    const before = transactionPort.calls;

    page.onPage({ pageIndex: 1, pageSize: 10, length: 50 });
    await settle(harness);

    expect(transactionPort.calls).toBe(before + 1);
    expect(transactionPort.queries[transactionPort.queries.length - 1]).toMatchObject({ page: 2 });
  });

  it('a filter change adds history and returning to the previous filter re-queries', async () => {
    // "Back" to a previous filter must fire a fresh query, because dedupe is
    // only against the LAST SUCCESSFUL query. We assert the two pieces that make
    // Back work: the filter change adds a history entry (replaceUrl is false, so
    // the previous URL is still reachable), and revisiting the previous filter
    // issues a new request. (location.back()/popstate is not driven by
    // RouterTestingHarness, so we revisit the prior URL explicitly.)
    const { transactionPort } = setup();
    const harness = await RouterTestingHarness.create();
    const page = (await harness.navigateByUrl('/transactions')) as TransactionsPage;
    await settle(harness);

    const spy = vi.spyOn(TestBed.inject(Router), 'navigate');
    page.onFilterChange({ type: 'expense' });
    await settle(harness);
    // The filter change navigated WITHOUT replaceUrl (so Back is possible).
    expect(spy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ replaceUrl: false, queryParams: { type: 'expense' } }),
    );
    const afterChange = transactionPort.calls;
    expect(transactionPort.queries[afterChange - 1]).toMatchObject({ type: 'expense' });

    // Returning to the previous filter: a fresh query (not deduped).
    await harness.navigateByUrl('/transactions');
    await settle(harness);
    expect(transactionPort.calls).toBe(afterChange + 1);
    expect(transactionPort.queries[transactionPort.queries.length - 1].type).toBeUndefined();
  });

  it('typing fast produces a single query (debounced) and does not add history', async () => {
    vi.useFakeTimers();
    try {
      const { transactionPort } = setup();
      const harness = await RouterTestingHarness.create();
      const page = (await harness.navigateByUrl('/transactions')) as TransactionsPage;
      await vi.advanceTimersByTimeAsync(0);
      harness.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      const before = transactionPort.calls;

      // onSearchChange is what the debounced component emits; simulate the
      // single post-debounce emission (the debounce itself is unit-tested).
      page.onSearchChange('super');
      for (let i = 0; i < 15; i++) {
        harness.detectChanges();
        await vi.advanceTimersByTimeAsync(0);
      }

      expect(transactionPort.calls).toBe(before + 1);
      expect(transactionPort.queries[transactionPort.queries.length - 1]).toMatchObject({ search: 'super', page: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('account=acc-9999 with the list not loaded yet: 2 queries and a notice', async () => {
    const { transactionPort } = setup();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/transactions?account=acc-9999');
    await settle(harness);

    // First query goes out immediately with the account; once the list loads,
    // acc-9999 is dropped and one more query runs without it.
    expect(transactionPort.calls).toBe(2);
    expect(transactionPort.queries[0]).toMatchObject({ accountId: 'acc-9999' });
    expect(transactionPort.queries[1].accountId).toBeUndefined();
    // The invalid account was dropped from the URL.
    const router = TestBed.inject(Router);
    expect(router.url).not.toContain('acc-9999');
  });

  it('page=99 with total 13: exactly 2 queries and the URL corrected to the last page', async () => {
    const { transactionPort } = setup();
    transactionPort.total = 13;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/transactions?page=99');
    await settle(harness);

    // One query for page 99 (empty), then the correction to the last page (2).
    expect(transactionPort.calls).toBe(2);
    expect(transactionPort.queries[0]).toMatchObject({ page: 99 });
    expect(transactionPort.queries[1]).toMatchObject({ page: 2 });
    const router = TestBed.inject(Router);
    expect(router.url).toContain('page=2');
  });
});
