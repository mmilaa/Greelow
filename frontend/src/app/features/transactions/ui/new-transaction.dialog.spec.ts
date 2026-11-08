import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NewTransactionDialog } from './new-transaction.dialog';
import { CategoryStore } from '../application/category.store';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { AccountsStore, type AccountRow } from '../../../shared/application/accounts.store';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { AccountPort } from '../../../shared/application/account.port';
import { type Account } from '../../../shared/domain/account';
import { type Transaction } from '../../../shared/domain/transaction';
import { Money } from '../../../shared/domain/money';
import { ApiErrorException } from '../../../shared/domain/map-api-error';
import { type NewTransactionRequest, type NewTransactionResult } from '../../../shared/ui/new-transaction-launcher';

function row(available: Money | null = Money.fromDecimal(1000, 'ARS')): AccountRow {
  const account: Account = { id: 'acc-1', name: 'Cuenta Pesos', currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
  return { account, available, hasPending: false };
}

function createdTxn(): Transaction {
  return {
    id: 'txn-new', accountId: 'acc-1', type: 'expense', direction: null, status: 'completed',
    amount: Money.fromDecimal(100, 'ARS'), category: 'groceries', description: 'x',
    counterpartAccountId: null, transferId: null, createdAt: '2026-11-07T10:00:00Z',
  };
}

class FakeCategoryStore {
  categoriesSig = signal<string[] | null>(['salary', 'freelance', 'rent', 'groceries', 'other']);
  failedSig = signal(false);
  categories = this.categoriesSig.asReadonly();
  failed = this.failedSig.asReadonly();
  loadOnce = vi.fn().mockResolvedValue(undefined);
}

class FakeTransactionPort {
  createCalls = 0;
  createError: unknown = null;
  gate: Promise<void> | null = null;
  async list() { throw new Error('not used'); }
  async create(): Promise<Transaction> {
    this.createCalls += 1;
    if (this.gate) await this.gate;
    if (this.createError) throw this.createError;
    return createdTxn();
  }
}

class FakeDialogRef {
  disableClose = false;
  closed: NewTransactionResult | undefined;
  close(result?: NewTransactionResult) {
    this.closed = result;
  }
}

function setup(data: NewTransactionRequest, port = new FakeTransactionPort()) {
  const categoryStore = new FakeCategoryStore();
  const dialogRef = new FakeDialogRef();
  const snack = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: CategoryStore, useValue: categoryStore },
      { provide: TransactionPort, useValue: port },
      { provide: MatSnackBar, useValue: snack },
      // The dialog does not inject these, but keep the module self-contained.
      { provide: AccountsStore, useValue: {} },
      { provide: PendingTransfersPort, useValue: {} },
      { provide: AccountPort, useValue: {} },
    ],
  });
  const fixture = TestBed.createComponent(NewTransactionDialog);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, categoryStore, port, dialogRef, snack };
}

const incomeData = (available?: Money | null): NewTransactionRequest => ({ row: row(available), type: 'income' });
const expenseData = (available?: Money | null): NewTransactionRequest => ({ row: row(available), type: 'expense' });

describe('NewTransactionDialog', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the type as title and the account as read-only text', () => {
    const { fixture } = setup(expenseData());
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[mat-dialog-title]')?.textContent).toContain('Registrar gasto');
    expect(el.textContent).toContain('Cuenta Pesos');
    expect(el.textContent).toContain('acc-1');
    // No account or type selector.
    expect(el.querySelector('mat-select[formcontrolname="account"]')).toBeNull();
  });

  it('submits and closes with created:true, announcing via snackbar', async () => {
    const { component, port, dialogRef, snack } = setup(expenseData());
    component.form.controls.amount.setValue('12,5');
    await component.submit();
    expect(port.createCalls).toBe(1);
    expect(dialogRef.closed).toEqual({ created: true });
    expect(snack.open).toHaveBeenCalled();
  });

  it('a double submit creates a single transaction', async () => {
    const port = new FakeTransactionPort();
    let release!: () => void;
    port.gate = new Promise<void>((r) => (release = r));
    const { component } = setup(expenseData(), port);
    component.form.controls.amount.setValue('100');
    const a = component.submit();
    const b = component.submit();
    release();
    await Promise.all([a, b]);
    expect(port.createCalls).toBe(1);
  });

  it('cannot be closed while submitting (disableClose + cancel is a no-op)', async () => {
    const port = new FakeTransactionPort();
    let release!: () => void;
    port.gate = new Promise<void>((r) => (release = r));
    const { component, dialogRef, fixture } = setup(expenseData(), port);
    component.form.controls.amount.setValue('100');
    const submitting = component.submit();
    fixture.detectChanges();
    expect(dialogRef.disableClose).toBe(true);
    component.cancel(); // ignored while submitting
    expect(dialogRef.closed).toBeUndefined();
    release();
    await submitting;
  });

  it('shows the uncertain-result message with a review link on a network error', async () => {
    const port = new FakeTransactionPort();
    port.createError = new ApiErrorException({ kind: 'network' });
    const { component, fixture } = setup(expenseData(), port);
    component.form.controls.amount.setValue('100');
    await component.submit();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No pudimos confirmar');
    expect(component.uncertain()).toBe(true);
    expect(el.querySelector('.dialog-error__link')).toBeTruthy();
  });

  it('navigates and closes when following the uncertain-result link', async () => {
    const port = new FakeTransactionPort();
    port.createError = new ApiErrorException({ kind: 'invalid-response' });
    const { component, dialogRef } = setup(expenseData(), port);
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.form.controls.amount.setValue('100');
    await component.submit();
    component.goToTransactions();
    expect(dialogRef.closed).toEqual({ created: false });
    expect(nav).toHaveBeenCalledWith(['/transactions'], { queryParams: { account: 'acc-1' } });
  });

  it('highlights the fields the API flags on a 400 (category, description)', async () => {
    const port = new FakeTransactionPort();
    port.createError = new ApiErrorException({
      kind: 'validation',
      fields: [{ field: 'category', message: 'x' }, { field: 'description', message: 'y' }],
    });
    const { component, fixture } = setup(expenseData(), port);
    component.form.controls.amount.setValue('100');
    await component.submit();
    fixture.detectChanges();
    expect(component.form.controls.category.hasError('server')).toBe(true);
    expect(component.form.controls.description.hasError('server')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Revisá los datos ingresados.');
  });

  it('warns when an expense leaves the account negative, without blocking submit', async () => {
    const { component, port } = setup(expenseData(Money.fromDecimal(440, 'ARS')));
    component.form.controls.amount.setValue('1000');
    expect(component.negativeWarning()).toBe(true);
    // Still submits (the warning does not block).
    await component.submit();
    expect(port.createCalls).toBe(1);
  });

  it('does not warn when the available balance is unknown', () => {
    const { component } = setup(expenseData(null));
    component.form.controls.amount.setValue('1000');
    expect(component.negativeWarning()).toBe(false);
  });

  it('shows the live preview while the amount is valid and hides it when invalid', () => {
    const { component } = setup(incomeData());
    component.form.controls.amount.setValue('100');
    expect(component.preview()).toContain('un ingreso');
    expect(component.preview()).toContain('Cuenta Pesos');
    component.form.controls.amount.setValue('abc');
    expect(component.preview()).toBeNull();
  });

  function amountError(fixture: { nativeElement: unknown }): string | null {
    const el = (fixture.nativeElement as HTMLElement).querySelector('mat-error');
    const text = el?.textContent?.trim();
    return text ? text : null;
  }

  it('marks "11." invalid and shows a mat-error after blur (DOM)', () => {
    const { component, fixture } = setup(incomeData());
    const amount = component.form.controls.amount;
    amount.setValue('11.');
    amount.markAsTouched(); // blur
    fixture.detectChanges();
    expect(amount.invalid).toBe(true);
    expect(amountError(fixture)).toBe('El monto no es válido. Usá solo números con coma o punto.');
  });

  it('marks "11.22,33,222,333," invalid and shows a mat-error after blur (DOM)', () => {
    const { component, fixture } = setup(incomeData());
    const amount = component.form.controls.amount;
    amount.setValue('11.22,33,222,333,');
    amount.markAsTouched();
    fixture.detectChanges();
    expect(amount.invalid).toBe(true);
    expect(amountError(fixture)).toBeTruthy();
  });

  it('accepts "11,5" and "11.25" with no error (DOM)', () => {
    const { component, fixture } = setup(incomeData());
    const amount = component.form.controls.amount;
    amount.setValue('11,5');
    amount.markAsTouched();
    fixture.detectChanges();
    expect(amount.valid).toBe(true);
    expect(amountError(fixture)).toBeNull();

    amount.setValue('11.25');
    fixture.detectChanges();
    expect(amount.valid).toBe(true);
    expect(amountError(fixture)).toBeNull();
  });

  it('submitting while empty shows the error, does not create and focuses the amount', async () => {
    const { component, fixture, port } = setup(incomeData());
    await component.submit();
    fixture.detectChanges();
    expect(port.createCalls).toBe(0);
    expect(component.form.controls.amount.touched).toBe(true);
    expect(amountError(fixture)).toBe('Ingresá un monto.');
  });

  it('submitting with an invalid amount shows the error and does not create', async () => {
    const { component, fixture, port } = setup(incomeData());
    component.form.controls.amount.setValue('11.');
    await component.submit();
    fixture.detectChanges();
    expect(port.createCalls).toBe(0);
    expect(amountError(fixture)).toBe('El monto no es válido. Usá solo números con coma o punto.');
  });

  it('offers only income categories (no rent, no transfer)', () => {
    const { component } = setup(incomeData());
    const opts = component.categoryOptions();
    expect(opts).toContain('salary');
    expect(opts).not.toContain('rent');
    expect(opts).not.toContain('transfer');
  });
});
