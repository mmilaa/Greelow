import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransactionRowComponent } from './transaction-row.component';
import { type Transaction } from '../domain/transaction';
import { Money } from '../domain/money';

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    type: 'expense',
    direction: null,
    status: 'completed',
    amount: Money.fromDecimal(100, 'ARS'),
    category: 'groceries',
    description: 'Super',
    counterpartAccountId: null,
    transferId: null,
    createdAt: '2026-10-20T16:00:00Z',
    ...overrides,
  };
}

function render(t: Transaction) {
  const fixture = TestBed.createComponent(TransactionRowComponent);
  fixture.componentRef.setInput('transaction', t);
  fixture.detectChanges();
  return fixture;
}

describe('TransactionRowComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the Spanish type label', () => {
    expect((render(txn({ type: 'income', direction: null })).nativeElement as HTMLElement).textContent).toContain('Ingreso');
    expect((render(txn({ type: 'expense', direction: null })).nativeElement as HTMLElement).textContent).toContain('Gasto');
    expect((render(txn({ type: 'transfer', direction: 'out' })).nativeElement as HTMLElement).textContent).toContain('Transferencia enviada');
    expect((render(txn({ type: 'transfer', direction: 'in' })).nativeElement as HTMLElement).textContent).toContain('Transferencia recibida');
  });

  it('translates a known category for income/expense', () => {
    const el = render(txn({ type: 'expense', category: 'groceries' })).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Supermercado');
  });

  it('omits the category on transfers', () => {
    const fixture = render(txn({ type: 'transfer', direction: 'out', category: 'transfer' }));
    expect(fixture.componentInstance.categoryText()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Transferencia\u00a0');
  });

  it('shows an unknown category capitalized', () => {
    const el = render(txn({ type: 'expense', category: 'crypto' })).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Crypto');
  });

  it('renders an income whose category is "transfer" without breaking (API allows it)', () => {
    // docs/api-samples/41: the API accepts an income with category transfer.
    // categoriesFor is a client rule; the row must still render.
    const fixture = render(txn({ type: 'income', direction: null, category: 'transfer' }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ingreso');
    // Category IS shown for non-transfer types (only transfer-type rows omit it).
    expect(el.textContent).toContain('Transferencia');
  });

  it('renders a <time> element with the raw ISO in datetime', () => {
    const el = render(txn()).nativeElement as HTMLElement;
    const time = el.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-10-20T16:00:00Z');
  });

  it('applies the signed amount (expense is negative)', () => {
    const signed = render(txn({ type: 'expense', amount: Money.fromDecimal(100, 'ARS') })).componentInstance.signed();
    expect(signed.isNegative()).toBe(true);
  });

  it('marks pending and failed as unsettled (dimmed) and still shows the chip', () => {
    const pending = render(txn({ status: 'pending' }));
    expect(pending.componentInstance.settled()).toBe(false);
    expect((pending.nativeElement as HTMLElement).querySelector('.transaction__amount--unsettled')).toBeTruthy();
    expect((pending.nativeElement as HTMLElement).textContent).toContain('Procesando');

    const failed = render(txn({ status: 'failed' }));
    expect(failed.componentInstance.settled()).toBe(false);
    expect((failed.nativeElement as HTMLElement).textContent).toContain('Fallida');
  });

  it('marks completed as settled (not dimmed)', () => {
    const fixture = render(txn({ status: 'completed' }));
    expect(fixture.componentInstance.settled()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.transaction__amount--unsettled')).toBeNull();
  });
});
