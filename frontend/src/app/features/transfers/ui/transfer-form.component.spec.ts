import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TransferFormComponent,
  type TransferFormSubmit,
} from './transfer-form.component';
import { eligibleDestinations } from '../domain/transfer-destinations';
import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';
import { type Currency } from '../../../shared/domain/currency';

function account(id: string, currency: Currency = 'ARS', name = `Cuenta ${id}`): Account {
  return { id, name, currency, balance: Money.fromDecimal(1000, currency), createdAt: '2026-08-01T09:00:00Z' };
}

const ACCOUNTS = [account('acc-1', 'ARS'), account('acc-2', 'ARS'), account('acc-3', 'USD')];

function setup() {
  TestBed.configureTestingModule({
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(TransferFormComponent);
  const cmp = fixture.componentInstance;
  fixture.componentRef.setInput('accounts', ACCOUNTS.map((a) => ({ id: a.id, name: a.name, currency: a.currency })));
  fixture.componentRef.setInput('destinations', eligibleDestinations(null, ACCOUNTS));
  fixture.detectChanges();
  return { fixture, cmp };
}

/** Refreshes the destinations input to match the current origin (as the page does). */
function syncDestinations(fixture: ComponentFixture<TransferFormComponent>, cmp: TransferFormComponent) {
  const originId = cmp.originAccount()?.id ?? null;
  fixture.componentRef.setInput('destinations', eligibleDestinations(originId, ACCOUNTS));
  fixture.detectChanges();
}

function text(fixture: ComponentFixture<TransferFormComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('TransferFormComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('preselects the origin via setOrigin (?from applied by the page)', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    syncDestinations(fixture, cmp);
    expect(cmp.originAccount()?.id).toBe('acc-1');
  });

  it('shows the available balance under the origin', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    fixture.componentRef.setInput('available', Money.fromDecimal(849000, 'ARS'));
    syncDestinations(fixture, cmp);
    expect(cmp.availableText()).toContain('849.000,00');
  });

  it('shows the available-unknown text and a Reintentar button', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    fixture.componentRef.setInput('availableUnknown', true);
    const spy = vi.fn();
    cmp.retryAvailable.subscribe(spy);
    syncDestinations(fixture, cmp);
    expect(text(fixture)).toContain('No pudimos calcular el saldo disponible');
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button');
    btn?.click();
    expect(spy).toHaveBeenCalled();
  });

  it('disables destinations while there is no origin, with a hint', () => {
    const { cmp } = setup();
    expect(cmp.hasOrigin()).toBe(false);
    expect(cmp.ineligibleHint()).toBe('Elegí primero la cuenta de origen');
  });

  it('marks the origin itself and other-currency accounts ineligible with their reason', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    syncDestinations(fixture, cmp);
    const opts = cmp.destinationOptions();
    const self = opts.find((o) => o.id === 'acc-1')!;
    const usd = opts.find((o) => o.id === 'acc-3')!;
    const peer = opts.find((o) => o.id === 'acc-2')!;
    expect(self.eligible).toBe(false);
    expect(self.reasonText).toBe('Es la cuenta de origen');
    expect(usd.eligible).toBe(false);
    expect(usd.reasonText).toBe('Moneda distinta');
    expect(peer.eligible).toBe(true);
  });

  it('lists the ineligible accounts and their reason in the hint', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    syncDestinations(fixture, cmp);
    const hint = cmp.ineligibleHint()!;
    expect(hint).toContain('No disponibles');
    expect(hint).toContain('Cuenta acc-3 (moneda distinta)');
  });

  it('never preselects a destination', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    syncDestinations(fixture, cmp);
    expect(cmp.form.controls.destination.value).toBe('');
  });

  it('clears a destination that stops being eligible when the origin changes', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    syncDestinations(fixture, cmp);
    cmp.form.controls.destination.setValue('acc-2'); // valid ARS peer
    // Change origin to the USD account: acc-2 is now cross-currency.
    cmp.setOrigin('acc-3');
    syncDestinations(fixture, cmp);
    expect(cmp.form.controls.destination.value).toBe('');
  });

  it('shows the no-destination message with a link when none is eligible', () => {
    // Only one ARS account plus a USD one: acc-3 origin has no eligible peer.
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-3'); // USD; the only USD account
    syncDestinations(fixture, cmp);
    expect(cmp.noDestinationMessage()).toContain('No tenés otra cuenta en USD');
  });

  it('recomputes the amount currency when the origin changes', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    syncDestinations(fixture, cmp);
    expect(cmp.originCurrency()).toBe('ARS');
    cmp.setOrigin('acc-3');
    syncDestinations(fixture, cmp);
    expect(cmp.originCurrency()).toBe('USD');
  });

  describe('amount validation and submit', () => {
    function ready(fixture: ComponentFixture<TransferFormComponent>, cmp: TransferFormComponent) {
      cmp.setOrigin('acc-1');
      syncDestinations(fixture, cmp);
      cmp.form.controls.destination.setValue('acc-2');
    }

    it('does not emit submit on an invalid amount (11.)', () => {
      const { fixture, cmp } = setup();
      ready(fixture, cmp);
      const spy = vi.fn();
      cmp.transferSubmit.subscribe(spy);
      cmp.form.controls.amount.setValue('11.');
      cmp.submit();
      expect(spy).not.toHaveBeenCalled();
      expect(cmp.amountErrorText()).not.toBe('');
    });

    it('does not emit submit on a thousands separator (1.234)', () => {
      const { fixture, cmp } = setup();
      ready(fixture, cmp);
      const spy = vi.fn();
      cmp.transferSubmit.subscribe(spy);
      cmp.form.controls.amount.setValue('1.234');
      cmp.submit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit submit on an empty amount', () => {
      const { fixture, cmp } = setup();
      ready(fixture, cmp);
      const spy = vi.fn();
      cmp.transferSubmit.subscribe(spy);
      cmp.submit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits submit with parsed Money for a valid amount', () => {
      const { fixture, cmp } = setup();
      ready(fixture, cmp);
      let payload: TransferFormSubmit | null = null;
      cmp.transferSubmit.subscribe((p) => (payload = p));
      cmp.form.controls.amount.setValue('1234,56');
      cmp.form.controls.description.setValue('  alquiler  ');
      cmp.submit();
      expect(payload).not.toBeNull();
      expect(payload!.originId).toBe('acc-1');
      expect(payload!.destinationId).toBe('acc-2');
      expect(payload!.amount.equals(Money.fromDecimal(1234.56, 'ARS'))).toBe(true);
      expect(payload!.description).toBe('alquiler');
    });

    it('does not emit submit while busy (guard) nor while in-flight from origin', () => {
      const { fixture, cmp } = setup();
      ready(fixture, cmp);
      cmp.form.controls.amount.setValue('100');
      const spy = vi.fn();
      cmp.transferSubmit.subscribe(spy);

      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      cmp.submit();
      expect(spy).not.toHaveBeenCalled();

      fixture.componentRef.setInput('busy', false);
      fixture.componentRef.setInput('inFlightFromOrigin', true);
      fixture.detectChanges();
      cmp.submit();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('resetForNext clears amount and description but keeps origin and destination', () => {
    const { fixture, cmp } = setup();
    cmp.setOrigin('acc-1');
    syncDestinations(fixture, cmp);
    cmp.form.controls.destination.setValue('acc-2');
    cmp.form.controls.amount.setValue('500');
    cmp.form.controls.description.setValue('x');
    cmp.resetForNext();
    expect(cmp.form.controls.amount.value).toBe('');
    expect(cmp.form.controls.description.value).toBe('');
    expect(cmp.form.controls.origin.value).toBe('acc-1');
    expect(cmp.form.controls.destination.value).toBe('acc-2');
  });

  it('shows a known create error inline (role=alert)', () => {
    const { fixture, cmp } = setup();
    fixture.componentRef.setInput('lastError', { kind: 'insufficient-funds' });
    fixture.detectChanges();
    expect(cmp.lastErrorText()).toContain('saldo');
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('saldo');
  });

  it('shows the in-flight message when in-flight from origin', () => {
    const { fixture, cmp } = setup();
    fixture.componentRef.setInput('inFlightFromOrigin', true);
    fixture.detectChanges();
    expect(text(fixture)).toContain('transferencia en curso');
  });
});
