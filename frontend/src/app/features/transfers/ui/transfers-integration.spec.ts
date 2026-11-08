import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TransfersPage } from './transfers.page';
import { TransferFormComponent } from './transfer-form.component';
import { AccountPort } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { TransactionPort, type TransactionQuery } from '../../../shared/application/transaction.port';
import { TransferPort, type CreateTransferInput } from '../application/transfer.port';
import { type Account } from '../../../shared/domain/account';
import { type Transaction } from '../../../shared/domain/transaction';
import { type AccountTransaction } from '../../../shared/domain/available-balance';
import { type Transfer } from '../domain/transfer';
import { type Page } from '../../../shared/domain/page';
import { Money } from '../../../shared/domain/money';
import { DEFAULT_SETTLEMENT_CONFIG } from '../domain/settlement';

/**
 * Integration test with the REAL stores (TransferStore + TransferTracker +
 * AccountsStore) mounted through the real page and router, and fakes of the
 * ports that count calls and throw on the 12th (a loop would blow past 12).
 *
 * Expected call counts for one valid transfer that confirms on the 2nd poll:
 *   - TransferPort.create:   1  (the single POST)
 *   - TransferPort.getById:  2  (poll 1 pending, poll 2 completed)
 *   - AccountPort.list:      3  (initial ensureLoaded + fresh read on submit + refresh on confirm)
 *   - PendingTransfersPort:  3  (same three reads; pending then accounts, in sequence)
 *   - TransactionPort.list:  0  (only the uncertain verification path uses it)
 */

const TRIP = 12;
function trip(name: string, n: number): void {
  if (n >= TRIP) throw new Error(`${name} called ${n} times (tripwire ${TRIP}): likely a loop`);
}

function account(id: string, balance = 1000): Account {
  return { id, name: id, currency: 'ARS', balance: Money.fromDecimal(balance, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

class CountingAccounts extends AccountPort {
  listCalls = 0;
  override async list(): Promise<Account[]> {
    this.listCalls += 1;
    trip('AccountPort.list', this.listCalls);
    return [account('acc-1'), account('acc-2')];
  }
  override async create(): Promise<Account> {
    throw new Error('not used');
  }
}

class CountingPending extends PendingTransfersPort {
  calls = 0;
  override async pendingOutgoing(): Promise<AccountTransaction[]> {
    this.calls += 1;
    trip('PendingTransfersPort.pendingOutgoing', this.calls);
    return [];
  }
}

class CountingTransactions extends TransactionPort {
  calls = 0;
  override async list(_query: TransactionQuery): Promise<Page<Transaction>> {
    this.calls += 1;
    trip('TransactionPort.list', this.calls);
    return { items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 };
  }
  override async create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

class CountingTransfers extends TransferPort {
  createCalls = 0;
  getByIdCalls = 0;
  override async create(_input: CreateTransferInput): Promise<Transfer> {
    this.createCalls += 1;
    trip('TransferPort.create', this.createCalls);
    return { id: 't-1', status: 'pending', from: null, to: {} as never };
  }
  override async getById(id: string): Promise<Transfer> {
    this.getByIdCalls += 1;
    trip('TransferPort.getById', this.getByIdCalls);
    return { id, status: this.getByIdCalls >= 2 ? 'completed' : 'pending', from: null, to: {} as never };
  }
}

function setup() {
  const accounts = new CountingAccounts();
  const pending = new CountingPending();
  const transactions = new CountingTransactions();
  const transfers = new CountingTransfers();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'transfers', component: TransfersPage },
        { path: 'accounts/:id', children: [] },
      ]),
      { provide: AccountPort, useValue: accounts },
      { provide: PendingTransfersPort, useValue: pending },
      { provide: TransactionPort, useValue: transactions },
      { provide: TransferPort, useValue: transfers },
    ],
  });
  return { accounts, pending, transactions, transfers };
}

const INTERVAL = DEFAULT_SETTLEMENT_CONFIG.intervalMs;

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('TransfersPage (integration, real stores + router)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('enter /transfers?from=acc-1, complete, submit and confirm — exact counts', async () => {
    const { accounts, pending, transactions, transfers } = setup();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/transfers?from=acc-1', TransfersPage);
    await settle();
    harness.detectChanges();

    // Initial load (ensureLoaded): 1 each.
    expect(accounts.listCalls).toBe(1);
    expect(pending.calls).toBe(1);

    // The form preselected acc-1 from ?from=.
    const form = harness.routeDebugElement!.query(
      (de) => de.componentInstance instanceof TransferFormComponent,
    ).componentInstance as TransferFormComponent;
    expect(form.originAccount()?.id).toBe('acc-1');

    // Choose destination acc-2 and a valid amount, then submit through the form.
    form.form.controls.destination.setValue('acc-2');
    form.form.controls.amount.setValue('100');
    harness.detectChanges();
    form.submit();
    await settle();
    harness.detectChanges();

    // Fresh read on submit: +1 each. One POST.
    expect(accounts.listCalls).toBe(2);
    expect(pending.calls).toBe(2);
    expect(transfers.createCalls).toBe(1);
    expect(page.state().status).toBe('tracking');

    // First poll after one interval -> pending -> retry.
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(transfers.getByIdCalls).toBe(1);

    // Second poll -> completed -> confirmed, which refreshes once (+1 each).
    await vi.advanceTimersByTimeAsync(INTERVAL);
    await settle();
    harness.detectChanges();

    expect(transfers.getByIdCalls).toBe(2);
    expect(page.state().status).toBe('confirmed');

    // Final, explained counts.
    expect(transfers.createCalls).toBe(1);
    expect(transfers.getByIdCalls).toBe(2);
    expect(accounts.listCalls).toBe(3); // ensureLoaded + submit read + confirm refresh
    expect(pending.calls).toBe(3); // same three reads
    expect(transactions.calls).toBe(0); // verification path untouched on the happy path

    // No leftover timers.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaving the page during tracking cancels the timers', async () => {
    const { transfers } = setup();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/transfers?from=acc-1', TransfersPage);
    await settle();
    harness.detectChanges();

    const form = harness.routeDebugElement!.query(
      (de) => de.componentInstance instanceof TransferFormComponent,
    ).componentInstance as TransferFormComponent;
    form.form.controls.destination.setValue('acc-2');
    form.form.controls.amount.setValue('100');
    form.submit();
    await settle();
    expect(transfers.createCalls).toBe(1);

    // Navigate away (destroys the page -> store.destroy() cancels the tracker).
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/accounts/acc-1');
    await settle();

    // Advancing time fires no further polls.
    const before = transfers.getByIdCalls;
    await vi.advanceTimersByTimeAsync(INTERVAL * 10);
    expect(transfers.getByIdCalls).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});
