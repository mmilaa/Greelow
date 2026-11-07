import { describe, it, expect } from 'vitest';
import { transactionTypeLabel, categoryLabel } from './transaction-labels';

describe('transactionTypeLabel', () => {
  it('labels the four type/direction combinations', () => {
    expect(transactionTypeLabel('income', null)).toBe('Ingreso');
    expect(transactionTypeLabel('expense', null)).toBe('Gasto');
    expect(transactionTypeLabel('transfer', 'out')).toBe('Transferencia enviada');
    expect(transactionTypeLabel('transfer', 'in')).toBe('Transferencia recibida');
  });
});

describe('categoryLabel', () => {
  it('translates the known categories', () => {
    expect(categoryLabel('salary')).toBe('Sueldo');
    expect(categoryLabel('groceries')).toBe('Supermercado');
    expect(categoryLabel('utilities')).toBe('Servicios');
    expect(categoryLabel('transfer')).toBe('Transferencia');
    expect(categoryLabel('other')).toBe('Otros');
  });

  it('shows an unknown category raw with its first letter capitalized', () => {
    expect(categoryLabel('crypto')).toBe('Crypto');
  });

  it('falls back to "Otros" for an empty category', () => {
    expect(categoryLabel('')).toBe('Otros');
  });
});
