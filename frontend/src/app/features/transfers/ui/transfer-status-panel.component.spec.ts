import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TransferStatusPanelComponent } from './transfer-status-panel.component';
import { type TransferState, type VerificationResult } from '../application/transfer.store';
import { type Transaction } from '../../../shared/domain/transaction';
import { Money } from '../../../shared/domain/money';

function render(state: TransferState) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(TransferStatusPanelComponent);
  fixture.componentRef.setInput('state', state);
  fixture.detectChanges();
  return fixture;
}

function text(fixture: ComponentFixture<TransferStatusPanelComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function buttonByText(fixture: ComponentFixture<TransferStatusPanelComponent>, label: string) {
  const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  return buttons.find((b) => (b.textContent ?? '').includes(label)) ?? null;
}

function outgoingLeg(id: string): Transaction {
  return {
    id, accountId: 'acc-1', type: 'transfer', direction: 'out', status: 'pending',
    amount: Money.fromDecimal(100, 'ARS'), category: 'transfer', description: '',
    counterpartAccountId: 'acc-2', transferId: 't-x', createdAt: '2026-11-07T10:00:00Z',
  };
}

function verification(partial: Partial<VerificationResult> = {}): VerificationResult {
  return { recentOutgoing: [], outgoingPending: [], readFailed: false, ...partial };
}

describe('TransferStatusPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('validating shows a progress status', () => {
    const fixture = render({ status: 'validating' });
    expect(text(fixture)).toContain('Validando');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });

  it('blocked shows the reason with role=alert (insufficient-funds includes the available)', () => {
    const fixture = render({ status: 'blocked', reason: 'insufficient-funds', available: Money.fromDecimal(1000, 'ARS') });
    expect(text(fixture)).toContain('1.000,00');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('blocked available-unknown shows a Reintentar button that emits', () => {
    const fixture = render({ status: 'blocked', reason: 'available-unknown', available: null });
    const cmp = fixture.componentInstance;
    const spy = vi.fn();
    cmp.retryAvailable.subscribe(spy);
    buttonByText(fixture, 'Reintentar')?.click();
    expect(spy).toHaveBeenCalled();
  });

  it('tracking shows the processing message in a status region', () => {
    const fixture = render({ status: 'tracking', attempt: 1, transferId: 't-1' });
    expect(text(fixture)).toContain('Procesando');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });

  it('confirmed shows Ver cuenta and Hacer otra transferencia, and a focusable heading', () => {
    const fixture = render({ status: 'confirmed' });
    expect(buttonByText(fixture, 'Ver cuenta')).not.toBeNull();
    expect(buttonByText(fixture, 'Hacer otra transferencia')).not.toBeNull();
    const heading = (fixture.nativeElement as HTMLElement).querySelector('#transfer-result-heading');
    expect(heading?.getAttribute('tabindex')).toBe('-1');
  });

  it('failed shows the failed message with role=alert', () => {
    const fixture = render({ status: 'failed' });
    expect(text(fixture)).toContain('falló');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('unconfirmed shows Verificar de nuevo', () => {
    const fixture = render({ status: 'unconfirmed' });
    const cmp = fixture.componentInstance;
    const spy = vi.fn();
    cmp.verifyAgain.subscribe(spy);
    buttonByText(fixture, 'Verificar de nuevo')?.click();
    expect(spy).toHaveBeenCalled();
  });

  describe('uncertain', () => {
    it('network shows the read list and Intentar de nuevo ONLY when verifying is false', () => {
      const withLeg = verification({ recentOutgoing: [outgoingLeg('tx-1')] });
      const fixture = render({ status: 'uncertain', kind: 'network', verifying: false, verification: withLeg });
      expect(buttonByText(fixture, 'Intentar de nuevo')).not.toBeNull();
      expect(buttonByText(fixture, 'Intentar de nuevo')?.hasAttribute('disabled')).toBe(false);
      // The read list is rendered (a transaction row).
      expect((fixture.nativeElement as HTMLElement).querySelector('app-transaction-row')).not.toBeNull();
    });

    it('network disables Intentar de nuevo while verifying', () => {
      const fixture = render({ status: 'uncertain', kind: 'network', verifying: true, verification: null });
      expect(buttonByText(fixture, 'Intentar de nuevo')?.hasAttribute('disabled')).toBe(true);
    });

    it('invalid-response does NOT show Intentar de nuevo', () => {
      const fixture = render({ status: 'uncertain', kind: 'invalid-response', verifying: false, verification: verification() });
      expect(buttonByText(fixture, 'Intentar de nuevo')).toBeNull();
      expect(buttonByText(fixture, 'Ver cuenta')).not.toBeNull();
      expect(buttonByText(fixture, 'Hacer otra transferencia')).not.toBeNull();
    });

    it('shows a one-line summary when there are outgoing pendings', () => {
      const v = verification({ outgoingPending: [
        { accountId: 'acc-1', direction: 'out', status: 'pending', amount: Money.fromDecimal(100, 'ARS') },
        { accountId: 'acc-1', direction: 'out', status: 'pending', amount: Money.fromDecimal(50, 'ARS') },
      ] });
      const fixture = render({ status: 'uncertain', kind: 'network', verifying: false, verification: v });
      expect(text(fixture)).toContain('Tenés 2 transferencia(s) en proceso');
    });

    it('shows the verification-failed notice when readFailed', () => {
      const v = verification({ readFailed: true });
      const fixture = render({ status: 'uncertain', kind: 'network', verifying: false, verification: v });
      expect(text(fixture)).toContain('No pudimos leer los movimientos');
    });
  });
});
