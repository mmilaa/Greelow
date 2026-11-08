import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AccountDetailPage } from './account-detail.page';
import { AccountDetailStore } from '../application/account-detail.store';
import { AccountsStore, type AccountsState, type AccountRow } from '../../../shared/application/accounts.store';
import { TransactionPort } from '../../../shared/application/transaction.port';
import {
  NewTransactionLauncher,
  type NewTransactionRequest,
  type NewTransactionResult,
} from '../../../shared/ui/new-transaction-launcher';
import { type Account } from '../../../shared/domain/account';
import { type Transaction } from '../../../shared/domain/transaction';
import { Money } from '../../../shared/domain/money';

class FakeLauncher extends NewTransactionLauncher {
  calls: NewTransactionRequest[] = [];
  result: NewTransactionResult = { created: false };
  override async open(request: NewTransactionRequest): Promise<NewTransactionResult> {
    this.calls.push(request);
    return this.result;
  }
}

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
  const launcher = new FakeLauncher();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      { provide: AccountsStore, useValue: accountsStore },
      { provide: TransactionPort, useClass: FakeTransactionPort },
      { provide: NewTransactionLauncher, useValue: launcher },
    ],
  });
  const fixture = TestBed.createComponent(AccountDetailPage);
  fixture.detectChanges();
  const detailStore = fixture.debugElement.injector.get(AccountDetailStore);
  return { fixture, accountsStore, launcher, detailStore, title: TestBed.inject(Title) };
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

  it('links "Ver todos" to the account\'s transactions', () => {
    const { fixture } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector('a[href*="/transactions?"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link!.textContent).toContain('Ver todos');
    expect(link!.getAttribute('href')).toContain('account=acc-1');
  });

  it('the register buttons open the dialog with this row and the right type', async () => {
    const { fixture, launcher } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button[aria-haspopup="dialog"]')) as HTMLButtonElement[];
    const income = buttons.find((b) => b.textContent?.includes('Registrar ingreso'))!;
    const expense = buttons.find((b) => b.textContent?.includes('Registrar gasto'))!;

    income.click();
    await Promise.resolve(); // let the first open settle (opening guard clears)
    await Promise.resolve();
    expense.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(launcher.calls).toHaveLength(2);
    expect(launcher.calls[0]).toMatchObject({ type: 'income' });
    expect(launcher.calls[0].row.account.id).toBe('acc-1');
    expect(launcher.calls[1]).toMatchObject({ type: 'expense' });
  });

  it('reloads the detail once when the dialog reports a created transaction', async () => {
    const { fixture, launcher, detailStore } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const reloadSpy = vi.spyOn(detailStore, 'reload');
    launcher.result = { created: true };
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
      .click();
    await Promise.resolve();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the dialog is cancelled (created false)', async () => {
    const { fixture, launcher, detailStore } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const reloadSpy = vi.spyOn(detailStore, 'reload');
    launcher.result = { created: false };
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
      .click();
    await Promise.resolve();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('shows an accessible notice when the dialog fails to open (no unhandled rejection)', async () => {
    const { fixture, launcher } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    launcher.open = () => Promise.reject(new Error('chunk load failed'));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
      .click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No pudimos abrir el formulario');
  });

  it('clears the launch-error notice on the next open attempt', async () => {
    const { fixture, launcher } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const component = fixture.componentInstance;
    const r = row('acc-1', 'Cuenta Pesos');
    let reject = true;
    launcher.open = () =>
      reject ? Promise.reject(new Error('fail')) : Promise.resolve({ created: false });

    await component.registerTransaction(r, 'income'); // fails -> error shown
    expect(component.launchError()).toBe(true);

    reject = false;
    await component.registerTransaction(r, 'income'); // retry clears it
    expect(component.launchError()).toBe(false);
  });

  it('ignores a click while a dialog is already opening (disabledInteractive guard)', async () => {
    const { fixture, launcher, detailStore } = setup(readyWith(row('acc-1', 'Cuenta Pesos')), 'acc-1');
    const reloadSpy = vi.spyOn(detailStore, 'reload');
    let release!: (r: { created: boolean }) => void;
    launcher.open = (req) => {
      launcher.calls.push(req);
      return new Promise((res) => (release = res));
    };

    const btn = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
    btn.click(); // first open: in flight
    await Promise.resolve();
    expect(launcher.calls).toHaveLength(1);

    btn.click(); // second click while opening: ignored
    await Promise.resolve();
    expect(launcher.calls).toHaveLength(1);

    release({ created: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(reloadSpy).toHaveBeenCalledTimes(1); // only one reload
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
