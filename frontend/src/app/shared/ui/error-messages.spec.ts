import { describe, it, expect } from 'vitest';
import { errorMessage, uncertainResultMessage, amountErrorMessage } from './error-messages';
import { type ApiError } from '../domain/map-api-error';

describe('errorMessage', () => {
  it('returns a general Spanish message for validation (fields are highlighted by the form)', () => {
    const msg = errorMessage({ kind: 'validation', fields: [{ field: 'email', message: 'x' }] });
    expect(msg).toBe('Revisá los datos ingresados.');
  });

  it('never leaks the raw API field message', () => {
    const msg = errorMessage({
      kind: 'validation',
      fields: [{ field: 'email', message: 'email is required' }],
    });
    expect(msg).not.toContain('email is required');
  });

  it('maps same-account', () => {
    expect(errorMessage({ kind: 'same-account' })).toBe('No podés transferir a la misma cuenta.');
  });

  it('maps insufficient-funds', () => {
    expect(errorMessage({ kind: 'insufficient-funds' })).toBe(
      'No tenés saldo disponible suficiente para esta transferencia.',
    );
  });

  it('maps not-found', () => {
    expect(errorMessage({ kind: 'not-found' })).toBe('No encontramos lo que buscás.');
  });

  it('maps invalid-credentials', () => {
    expect(errorMessage({ kind: 'invalid-credentials' })).toBe(
      'El email o la contraseña son incorrectos.',
    );
  });

  it('maps unauthenticated', () => {
    expect(errorMessage({ kind: 'unauthenticated' })).toBe(
      'Tu sesión expiró. Volvé a iniciar sesión.',
    );
  });

  it('maps network', () => {
    expect(errorMessage({ kind: 'network' })).toBe(
      'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.',
    );
  });

  it('maps invalid-response', () => {
    expect(errorMessage({ kind: 'invalid-response' })).toBe(
      'Recibimos una respuesta inesperada del servidor. Intentá de nuevo.',
    );
  });

  it('maps unknown', () => {
    expect(errorMessage({ kind: 'unknown', status: 500 })).toBe(
      'Ocurrió un error inesperado. Intentá de nuevo.',
    );
  });

  it('every ApiError kind produces a non-empty message', () => {
    const samples: ApiError[] = [
      { kind: 'validation', fields: [] },
      { kind: 'same-account' },
      { kind: 'insufficient-funds' },
      { kind: 'not-found' },
      { kind: 'invalid-credentials' },
      { kind: 'unauthenticated' },
      { kind: 'network' },
      { kind: 'invalid-response' },
      { kind: 'unknown', status: 0 },
    ];
    for (const e of samples) {
      expect(errorMessage(e).length).toBeGreaterThan(0);
    }
  });
});

describe('uncertainResultMessage', () => {
  it('uses "el movimiento" for a transaction', () => {
    expect(uncertainResultMessage('movimiento')).toContain('el movimiento');
    expect(uncertainResultMessage('movimiento')).toContain('No pudimos confirmar');
  });

  it('uses "la transferencia" for a transfer', () => {
    expect(uncertainResultMessage('transferencia')).toContain('la transferencia');
  });
});

describe('amountErrorMessage', () => {
  it('has a non-empty message for every reason', () => {
    for (const r of ['empty', 'invalid-format', 'too-many-decimals', 'not-positive', 'too-large'] as const) {
      expect(amountErrorMessage(r).length).toBeGreaterThan(0);
    }
  });

  it('explains that the type decides sign for not-positive', () => {
    expect(amountErrorMessage('not-positive')).toContain('mayor a cero');
  });

  it('mentions the thousands separator and the example for too-many-decimals', () => {
    const msg = amountErrorMessage('too-many-decimals');
    expect(msg).toContain('miles');
    expect(msg).toContain('1234,56');
  });
});
