import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MoneyAmountComponent } from './money-amount.component';
import { Money } from '../domain/money';

function render(amount: Money) {
  const fixture = TestBed.createComponent(MoneyAmountComponent);
  fixture.componentRef.setInput('amount', amount);
  fixture.detectChanges();
  return fixture;
}

describe('MoneyAmountComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the formatted amount with its currency code', () => {
    const el = render(Money.fromDecimal(1234.56, 'ARS')).nativeElement as HTMLElement;
    expect(el.textContent).toContain('ARS');
    expect(el.textContent).toContain('1.234,56');
  });

  it('shows the negative sign in the text (not only via colour)', () => {
    const fixture = render(Money.fromDecimal(-50, 'ARS'));
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('-');
    expect(fixture.componentInstance.isNegative()).toBe(true);
  });

  it('does not mark a positive amount as negative', () => {
    const fixture = render(Money.fromDecimal(50, 'ARS'));
    expect(fixture.componentInstance.isNegative()).toBe(false);
  });
});
