import { describe, it, expect } from 'vitest';
import { categoriesFor } from './transaction-categories';

// Spanish labels used only to drive the ordering in these tests (mirrors the
// shared categoryLabel; the real function is injected by the component).
const LABELS: Record<string, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  rent: 'Alquiler',
  groceries: 'Supermercado',
  transport: 'Transporte',
  entertainment: 'Entretenimiento',
  utilities: 'Servicios',
  health: 'Salud',
  transfer: 'Transferencia',
  other: 'Otros',
};
const labelOf = (c: string) => LABELS[c] ?? c;

const FULL = Object.keys(LABELS);

describe('categoriesFor', () => {
  it('income: salary/freelance/other, never rent or transfer', () => {
    const r = categoriesFor('income', FULL, labelOf);
    expect(r).toContain('salary');
    expect(r).toContain('freelance');
    expect(r).toContain('other');
    expect(r).not.toContain('rent');
    expect(r).not.toContain('transfer');
  });

  it('expense: has rent/groceries/etc, never salary or transfer', () => {
    const r = categoriesFor('expense', FULL, labelOf);
    expect(r).toContain('rent');
    expect(r).toContain('groceries');
    expect(r).not.toContain('salary');
    expect(r).not.toContain('transfer');
  });

  it('transfer: empty (this form does not create transfers)', () => {
    expect(categoriesFor('transfer', FULL, labelOf)).toEqual([]);
  });

  it('orders alphabetically by Spanish label with "other" last (expense)', () => {
    // Labels: Alquiler, Entretenimiento, Salud, Servicios, Supermercado, Transporte, Otros
    expect(categoriesFor('expense', FULL, labelOf)).toEqual([
      'rent', // Alquiler
      'entertainment', // Entretenimiento
      'health', // Salud
      'utilities', // Servicios
      'groceries', // Supermercado
      'transport', // Transporte
      'other', // Otros (last)
    ]);
  });

  it('orders alphabetically by Spanish label with "other" last (income)', () => {
    // Labels: Freelance, Sueldo, Otros
    expect(categoriesFor('income', FULL, labelOf)).toEqual(['freelance', 'salary', 'other']);
  });

  it('intersects with the real catalogue (drops a removed category)', () => {
    const catalogWithoutRent = FULL.filter((c) => c !== 'rent');
    expect(categoriesFor('expense', catalogWithoutRent, labelOf)).not.toContain('rent');
  });

  it('ignores catalogue entries that are not allowed for the type', () => {
    // An extra unknown category in the catalogue is never offered.
    const r = categoriesFor('income', [...FULL, 'crypto'], labelOf);
    expect(r).not.toContain('crypto');
  });
});
