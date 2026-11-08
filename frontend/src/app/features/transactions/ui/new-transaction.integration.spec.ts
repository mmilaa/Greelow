import { describe, it, expect, beforeEach } from 'vitest';
import { Injectable, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountDetailPage } from '../../accounts/ui/account-detail.page';
import { NewTransactionDialog } from './new-transaction.dialog';
import {
  NewTransactionLauncher,
  type NewTransactionRequest,
  type NewTransactionResult,
} from '../../../shared/ui/new-transaction-launcher';
import { AccountPort } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import {
  TransactionPort,
  type TransactionQuery,
  type CreateTransactionInput,
} from '../../../shared/application/transaction.port';
import { CategoryPort } from '../application/category.port';
import { type Account } from '../../../shared/domain/account';
import { type Transaction } from '../../../shared/domain/transaction';
import { type AccountTransaction } from '../../../shared/domain/available-balance';
import { type Page } from '../../../shared/domain/page';
import { Money } from '../../../shared/domain/money';

const CALL_CAP = 5;

function account(id: string, name: string): Account {
  return { id, name, currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

class CountingAccountPort extends AccountPort {
  calls = 0;
  override async list(): Promise<Account[]> {
    if (++this.calls > CALL_CAP) throw new Error('AccountPort.list too many times');
    return [account('acc-1', 'Cuenta Pesos')];
  }
  override async create(): Promise<Account> {
    return account('new', 'New');
  }
}
class CountingPendingPort extends PendingTransfersPort {
  calls = 0;
  override async pendingOutgoing(): Promise<AccountTransaction[]> {
    if (++this.calls > CALL_CAP) throw new Error('Pending too many times');
    return [];
  }
}
class CountingCategoryPort extends CategoryPort {
  calls = 0;
  override async list(): Promise<string[]> {
    if (++this.calls > CALL_CAP) throw new Error('Categories too many times');
    return ['salary', 'freelance', 'rent', 'groceries', 'other'];
  }
}
class CountingTransactionPort extends TransactionPort {
  listCalls = 0;
  createCalls = 0;
  lastCreate: CreateTransactionInput | null = null;
  queries: TransactionQuery[] = [];
  override async list(query: TransactionQuery): Promise<Page<Transaction>> {
    this.queries.push(query);
    if (++this.listCalls > CALL_CAP) throw new Error('list too many times');
    return { items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 };
  }
  override async create(input: CreateTransactionInput): Promise<Transaction> {
    this.lastCreate = input;
    if (++this.createCalls > CALL_CAP) throw new Error('create too many times');
    return {
      id: 'txn-new', accountId: input.accountId, type: input.type, direction: null,
      status: 'completed', amount: input.amount, category: input.category ?? 'other',
      description: input.description ?? '', counterpartAccountId: null, transferId: null,
      createdAt: '2026-11-07T10:00:00Z',
    };
  }
}

/** Mutable holders so the launcher can feed data to the TestBed-created dialog. */
const dialogData: { current: NewTransactionRequest | null } = { current: null };
const dialogRefStub = {
  disableClose: false,
  closed: undefined as NewTransactionResult | undefined,
  close(result?: NewTransactionResult) {
    this.closed = result;
  },
};

/**
 * Launcher that renders the REAL dialog component via TestBed (no overlay, whose
 * async attach/teardown races the test), fills it and submits. This exercises
 * the real dialog + its CreateTransactionStore + the detail reload with the real
 * stores, which is what we verify; the MatDialog overlay is production glue
 * tested by the dialog unit spec (disableClose, close results).
 */
@Injectable()
class TestLauncher extends NewTransactionLauncher {
  amount = '12,5';
  category = 'groceries';
  description = '  Super  ';
  override async open(request: NewTransactionRequest): Promise<NewTransactionResult> {
    dialogData.current = request;
    dialogRefStub.closed = undefined;
    const fixture = TestBed.createComponent(NewTransactionDialog);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.amount.setValue(this.amount);
    component.form.controls.category.setValue(this.category);
    component.form.controls.description.setValue(this.description);
    await component.submit();
    return dialogRefStub.closed ?? { created: false };
  }
}

function setup() {
  const accountPort = new CountingAccountPort();
  const pendingPort = new CountingPendingPort();
  const categoryPort = new CountingCategoryPort();
  const transactionPort = new CountingTransactionPort();
  const launcher = new TestLauncher();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'accounts/:id', component: AccountDetailPage },
        { path: 'transactions', children: [] },
      ]),
      { provide: AccountPort, useValue: accountPort },
      { provide: PendingTransfersPort, useValue: pendingPort },
      { provide: CategoryPort, useValue: categoryPort },
      { provide: TransactionPort, useValue: transactionPort },
      { provide: NewTransactionLauncher, useValue: launcher },
      { provide: MatSnackBar, useValue: { open: () => undefined } },
      { provide: MAT_DIALOG_DATA, useFactory: () => dialogData.current },
      { provide: MatDialogRef, useValue: dialogRefStub },
    ],
  });
  return { accountPort, pendingPort, categoryPort, transactionPort, launcher };
}

async function settle(harness: RouterTestingHarness): Promise<void> {
  for (let i = 0; i < 20; i++) {
    harness.detectChanges();
    await Promise.resolve();
  }
}

describe('New transaction dialog (integration, real stores + router)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('open from the detail, submit, and the detail reloads with exact call counts', async () => {
    const { accountPort, pendingPort, categoryPort, transactionPort } = setup();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/accounts/acc-1');
    await settle(harness);

    // Click "Registrar gasto" to open the dialog through the launcher.
    const detailEl = harness.routeNativeElement as HTMLElement;
    const expenseBtn = Array.from(detailEl.querySelectorAll('button[aria-haspopup="dialog"]')).find(
      (b) => b.textContent?.includes('Registrar gasto'),
    ) as HTMLButtonElement;
    expenseBtn.click();
    await settle(harness);

    expect(transactionPort.createCalls).toBe(1);
    expect(transactionPort.lastCreate).toMatchObject({
      accountId: 'acc-1',
      type: 'expense',
      category: 'groceries',
      description: 'Super',
    });
    expect(transactionPort.lastCreate!.amount.toDecimal()).toBe(12.5);

    // Categories loaded once by the dialog.
    expect(categoryPort.calls).toBe(1);

    // Detail: initial load on entering (accounts 1, pending 1, transactions 1),
    // plus the reload after creating (accounts 2, pending 2, transactions 2).
    expect(accountPort.calls).toBe(2);
    expect(pendingPort.calls).toBe(2);
    expect(transactionPort.listCalls).toBe(2);
  });
});
