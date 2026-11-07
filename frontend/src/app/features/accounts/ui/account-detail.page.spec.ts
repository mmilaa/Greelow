import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AccountDetailPage } from './account-detail.page';
import { AccountsStore, type AccountsState, type AccountRow } from '../application/accounts.store';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { type Account } from '../../../shared/domain/account';
import { type Transaction } from '../../../shared/domain/transaction';
import { Money } from '../../../shared/domain/money';

function row(id: string, name: string): AccountRow {
  const account: Account = { id, name, currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
  return { account, available: account.balance, hasPending: false };
}

function paramMap(id: string | null) {
  return { get: (k: string) => (k === 'id' ? id : null) };
}

class FakeTransactionPort {
  items: Transaction[] = [];
  async list() {
    return { items: this.items, page: 1, pageSize: 5, total: this.items.length, totalPages: 1 };
  }
  create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

function setup(listState: AccountsState, routeId: string | null) {
  const stateSig = signal<AccountsState>(listState);
  const accountsStore = {
    state: stateSig.asReadonly(),
    stateSig,
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
  const route = {
    paramMap: of(paramMap(routeId)),
    snapshot: { paramMap: paramMap(routeId) },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      { provide: AccountsStore, useValue: accountsStore },
      { provide: TransactionPort, useClass: FakeTransactionPort },
    ],
  });
  const fixture = TestBed.createComponent(AccountDetailPage);
  fixture.detectChanges();
  return { fixture, accountsStore, title: TestBed.inject(Title) };
}

const readyWith = (r: AccountRow): AccountsState => ({ status: 'ready', rows: [r], pendingAvailable: true, stale: false });

describe('AccountDetailPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the account card when the id is found', () => {
    const { fixture } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Cuenta Pesos');
    expect(el.textContent).toContain('acc-1');
  });

  it('shows "Cuenta no encontrada" with a back link when the id is absent', () => {
    const { fixture } = setup(readyWith(row('acc-2', 'Otra')), 'acc-1');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cuenta no encontrada');
    const back = el.querySelector('a[href="/accounts"]');
    expect(back).toBeTruthy();
  });

  it('shows an error (not "not found") when the list failed', () => {
    const { fixture } = setup({ status: 'error' }, 'acc-1');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No pudimos cargar la cuenta');
    expect(el.textContent).not.toContain('no encontrada');
  });

  it('links Transferir to /transfers with the account id as from', () => {
    const { fixture } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector('a[href*="/transfers"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toContain('from=acc-1');
  });

  it('sets the tab title to the account name (case I)', async () => {
    const { title } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    await vi.waitFor(() => expect(title.getTitle()).toBe('Cuenta Pesos'));
  });

  it('uses "Cuenta" as the title while the account is not resolved', async () => {
    const { title } = setup({ status: 'loading' }, 'acc-1');
    await vi.waitFor(() => expect(title.getTitle()).toBe('Cuenta'));
  });
});
