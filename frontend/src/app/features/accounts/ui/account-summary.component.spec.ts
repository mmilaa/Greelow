import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AccountSummaryComponent } from './account-summary.component';
import { type AccountRow } from '../../../shared/application/accounts.store';
import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';

function account(): Account {
  return { id: 'acc-1', name: 'Cuenta Pesos', currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

function render(row: AccountRow) {
  const fixture = TestBed.createComponent(AccountSummaryComponent);
  fixture.componentRef.setInput('row', row);
  fixture.detectChanges();
  return fixture;
}

describe('AccountSummaryComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the currency code and the ledger balance', () => {
    const el = render({ account: account(), available: account().balance, hasPending: false })
      .nativeElement as HTMLElement;
    expect(el.textContent).toContain('ARS');
    expect(el.textContent).toContain('1.000,00');
    expect(el.textContent).toContain('Saldo');
  });

  it('shows the available balance and the "in process" notice only when there are pending', () => {
    const el = render({
      account: account(),
      available: Money.fromDecimal(700, 'ARS'),
      hasPending: true,
    }).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Disponible');
    expect(el.textContent).toContain('700,00');
    expect(el.textContent).toContain('Hay transferencias en proceso');
  });

  it('does not show available or notice without pending', () => {
    const el = render({ account: account(), available: account().balance, hasPending: false })
      .nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Disponible');
    expect(el.textContent).not.toContain('en proceso');
  });
});
