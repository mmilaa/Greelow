import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransferStore, type TransferRequest } from './transfer.store';
import { TransferTracker } from './transfer-tracker';
import { TransferPort, type CreateTransferInput } from './transfer.port';
import { type Transfer } from '../domain/transfer';
import { AccountsStore } from '../../../shared/application/accounts.store';
import { AccountPort } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { type Account } from '../../../shared/domain/account';
import { type AccountTransaction } from '../../../shared/domain/available-balance';
import { type Transaction } from '../../../shared/domain/transaction';
import { type Page } from '../../../shared/domain/page';
import { Money } from '../../../shared/domain/money';
import { DEFAULT_SETTLEMENT_CONFIG } from '../domain/settlement';

/**
 * Integration test with the REAL stores (TransferStore + TransferTracker +
 * AccountsStore) and fakes of the ports that count calls. The fakes throw on the
 * 12th call of any port method to prove the happy path never fans out: a loop
 * bug would blow past 12 and surface as a thrown error instead of a silent pass.
 *
 * Expected call counts for one valid transfer that confirms on the 2nd poll:
 *   - TransferPort.create:        1  (the single POST)
 *   - TransferPort.getById:       2  (poll 1 pending, poll 2 completed)
 *   - AccountPort.list:           3  (initial load + fresh read on submit + refresh on confirm)
 *   - PendingTransfersPort:       3  (same three reads; AccountsStore reads pending then accounts)
 *   - TransactionPort.list:       0  (only used by the uncertain verification path)
 */

const TRIP = 12;

function tripwire(name: string, count: number): void {
  if (count >= TRIP) {
    throw new Error(`${name} called ${count} times (tripwire at ${TRIP}): likely a loop`);
  }
}

function account(id: string, balance: number): Account {
  return { id, name: id, currency: 'ARS', balance: Money.fromDecimal(balance, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

class CountingAccounts extends AccountPort {
  listCalls = 0;
  override async list(): Promise<Account[]> {
    this.listCalls += 1;
    tripwire('AccountPort.list', this.listCalls);
    return [account('acc-1', 1000)];
  }
  override async create(): Promise<Account> {
    throw new Error('not used');
  }
}

class CountingPending extends PendingTransfersPort {
  calls = 0;
  override async pendingOutgoing(): Promise<AccountTransaction[]> {
    this.calls += 1;
    tripwire('PendingTransfersPort.pendingOutgoing', this.calls);
    return [];
  }
}

class CountingTransactions extends TransactionPort {
  calls = 0;
  override async list(): Promise<Page<Transaction>> {
    this.calls += 1;
    tripwire('TransactionPort.list', this.calls);
    return { items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 };
  }
  override async create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

class CountingTransfers extends TransferPort {
  createCalls = 0;
  getByIdCalls = 0;
  override async create(_: CreateTransferInput): Promise<Transfer> {
    this.createCalls += 1;
    tripwire('TransferPort.create', this.createCalls);
    return { id: 't-1', status: 'pending', from: null, to: {} as never };
  }
  override async getById(id: string): Promise<Transfer> {
    this.getByIdCalls += 1;
    tripwire('TransferPort.getById', this.getByIdCalls);
    // Poll 1 -> pending, poll 2+ -> completed.
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
      AccountsStore,
      TransferTracker,
      TransferStore,
      { provide: AccountPort, useValue: accounts },
      { provide: PendingTransfersPort, useValue: pending },
      { provide: TransactionPort, useValue: transactions },
      { provide: TransferPort, useValue: transfers },
    ],
  });
  return {
    accountsStore: TestBed.inject(AccountsStore),
    store: TestBed.inject(TransferStore),
    accounts,
    pending,
    transactions,
    transfers,
  };
}

const INTERVAL = DEFAULT_SETTLEMENT_CONFIG.intervalMs;

function req(): TransferRequest {
  return {
    fromAccountId: 'acc-1',
    destination: { kind: 'own', accountId: 'acc-9', currency: 'ARS' },
    amount: Money.fromDecimal(100, 'ARS'),
  };
}

describe('transfer flow (integration, real stores)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('a valid transfer confirms on the 2nd poll with exact, explained call counts', async () => {
    const { accountsStore, store, accounts, pending, transactions, transfers } = setup();

    // Initial load: AccountPort.list = 1, PendingTransfersPort = 1.
    await accountsStore.load();
    expect(accounts.listCalls).toBe(1);
    expect(pending.calls).toBe(1);

    // submit -> validating -> fresh read (refresh): +1 each -> 2 and 2.
    await store.submit(req());
    expect(accounts.listCalls).toBe(2);
    expect(pending.calls).toBe(2);
    expect(transfers.createCalls).toBe(1); // the single POST
    expect(store.state().status).toBe('tracking');

    // Tracking: first poll after one interval -> pending -> retry.
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(transfers.getByIdCalls).toBe(1);
    expect(store.state().status).toBe('tracking');

    // Second poll -> completed -> confirmed, which refreshes once (+1 each).
    await vi.advanceTimersByTimeAsync(INTERVAL);
    await vi.runAllTicks();
    expect(transfers.getByIdCalls).toBe(2);
    expect(store.state().status).toBe('confirmed');

    // Final counts.
    expect(transfers.createCalls).toBe(1);
    expect(transfers.getByIdCalls).toBe(2);
    expect(accounts.listCalls).toBe(3); // load + submit read + confirm refresh
    expect(pending.calls).toBe(3); // same three reads
    expect(transactions.calls).toBe(0); // verification path untouched on the happy path

    // No timer left behind.
    expect(vi.getTimerCount()).toBe(0);
  });
});
