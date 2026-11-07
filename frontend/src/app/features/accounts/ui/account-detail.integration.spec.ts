import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AccountDetailPage } from './account-detail.page';
import { AccountPort } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import {
  TransactionPort,
  type TransactionQuery,
} from '../../../shared/application/transaction.port';
import { type Account } from '../../../shared/domain/account';
import { type Transaction } from '../../../shared/domain/transaction';
import { type AccountTransaction } from '../../../shared/domain/available-balance';
import { Money } from '../../../shared/domain/money';

const CALL_CAP = 5;

function account(id: string, name: string): Account {
  return { id, name, currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

/** Counts calls and throws if a method is called more than CALL_CAP times, so a
 *  runaway effect/loop fails fast instead of exhausting memory. */
class CountingAccountPort extends AccountPort {
  listCalls = 0;
  override async list(): Promise<Account[]> {
    if (++this.listCalls > CALL_CAP) throw new Error(`AccountPort.list called too many times (${this.listCalls})`);
    return [account('acc-1', 'Cuenta Pesos'), account('acc-2', 'Cuenta Dólares')];
  }
  override async create(): Promise<Account> {
    return account('new', 'New');
  }
}

class CountingPendingPort extends PendingTransfersPort {
  calls = 0;
  override async pendingOutgoing(): Promise<AccountTransaction[]> {
    if (++this.calls > CALL_CAP) throw new Error(`PendingTransfersPort called too many times (${this.calls})`);
    return [];
  }
}

class CountingTransactionPort extends TransactionPort {
  calls = 0;
  queries: TransactionQuery[] = [];
  override async list(query: TransactionQuery) {
    this.queries.push(query);
    if (++this.calls > CALL_CAP) throw new Error(`TransactionPort.list called too many times (${this.calls})`);
    return { items: [] as Transaction[], page: 1, pageSize: 5, total: 0, totalPages: 0 };
  }
  override async create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

function setup() {
  const accountPort = new CountingAccountPort();
  const pendingPort = new CountingPendingPort();
  const transactionPort = new CountingTransactionPort();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'accounts/:id', component: AccountDetailPage },
        { path: 'accounts', children: [] },
      ]),
      { provide: AccountPort, useValue: accountPort },
      { provide: PendingTransfersPort, useValue: pendingPort },
      { provide: TransactionPort, useValue: transactionPort },
    ],
  });
  return { accountPort, pendingPort, transactionPort };
}

/** Lets microtasks settle so any runaway loop would trip the call caps. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('AccountDetailPage (integration, real stores + router)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('navigating to /accounts/acc-1 makes exactly one of each call, bounded', async () => {
    const { accountPort, pendingPort, transactionPort } = setup();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/accounts/acc-1');
    await settle();

    expect(pendingPort.calls).toBe(1);
    expect(accountPort.listCalls).toBe(1);
    expect(transactionPort.calls).toBe(1);
    expect(transactionPort.queries[0]).toEqual({ accountId: 'acc-1', page: 1, pageSize: 5 });
  });

  it('mounting AccountDetailPage directly stays bounded (same setup)', async () => {
    const { accountPort, pendingPort, transactionPort } = setup();
    const harness = await RouterTestingHarness.create('/accounts/acc-1');
    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(AccountDetailPage);
    await settle();

    expect(pendingPort.calls).toBeLessThanOrEqual(1);
    expect(accountPort.listCalls).toBeLessThanOrEqual(1);
    expect(transactionPort.calls).toBe(1);
  });

  it('navigating from acc-1 to acc-2 keeps the calls bounded', async () => {
    const { accountPort, pendingPort, transactionPort } = setup();
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/accounts/acc-1');
    await settle();
    await harness.navigateByUrl('/accounts/acc-2');
    await settle();

    // One transactions request per account visited.
    expect(transactionPort.calls).toBe(2);
    expect(transactionPort.queries.map((q) => q.accountId)).toEqual(['acc-1', 'acc-2']);
    // Accounts and pending are each called exactly twice: the initial load on
    // entering acc-1 (list not ready -> ensureLoaded), and the refresh when
    // switching to acc-2 (list already ready -> refresh). A double load would
    // push these past 2 and fail here.
    expect(accountPort.listCalls).toBe(2);
    expect(pendingPort.calls).toBe(2);
  });
});
