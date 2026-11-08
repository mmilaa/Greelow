import { describe, it, expect } from 'vitest';
import {
  transferBlockMessage,
  transferCreateErrorMessage,
  transferUncertainMessage,
} from './transfer-messages';
import { Money } from '../../../shared/domain/money';

describe('transferBlockMessage', () => {
  it('includes the available balance for insufficient-funds when known', () => {
    const msg = transferBlockMessage('insufficient-funds', Money.fromDecimal(1000, 'ARS'));
    expect(msg).toContain('ARS');
    expect(msg).toContain('1.000,00');
  });

  it('falls back to a generic message for insufficient-funds without a known available', () => {
    const msg = transferBlockMessage('insufficient-funds', null);
    expect(msg).toContain('saldo disponible');
    expect(msg).not.toMatch(/ARS\s/);
  });

  it('has text for the policy reasons and the store reasons', () => {
    expect(transferBlockMessage('same-account')).toContain('misma cuenta');
    expect(transferBlockMessage('cross-currency')).toContain('moneda');
    expect(transferBlockMessage('unknown-destination-currency')).toContain('moneda');
    expect(transferBlockMessage('non-positive-amount')).toContain('mayor a cero');
    expect(transferBlockMessage('available-unknown')).toContain('disponible');
    expect(transferBlockMessage('in-flight-from-account')).toContain('en curso');
  });
});

describe('transferCreateErrorMessage', () => {
  it('reuses the shared catalog for a known error kind', () => {
    expect(transferCreateErrorMessage({ kind: 'insufficient-funds' })).toContain('saldo');
    expect(transferCreateErrorMessage({ kind: 'not-found' })).toContain('No encontramos');
  });
});

describe('transferUncertainMessage', () => {
  it('uses the shared uncertain message for a network error', () => {
    expect(transferUncertainMessage('network')).toContain('No pudimos confirmar');
    expect(transferUncertainMessage('network')).toContain('la transferencia');
  });

  it('for invalid-response says the server accepted it and not to resend', () => {
    const msg = transferUncertainMessage('invalid-response');
    expect(msg).toContain('aceptó la transferencia');
    expect(msg).toContain('no vuelvas a');
  });
});
