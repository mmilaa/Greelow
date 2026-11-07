import { describe, it, expect } from 'vitest';
import { spanishPaginatorIntl } from './paginator-intl.es';

describe('spanishPaginatorIntl', () => {
  it('translates the labels', () => {
    const intl = spanishPaginatorIntl();
    expect(intl.itemsPerPageLabel).toBe('Movimientos por página');
    expect(intl.nextPageLabel).toBe('Página siguiente');
    expect(intl.previousPageLabel).toBe('Página anterior');
  });

  it('formats a range with the Spanish "de"', () => {
    const intl = spanishPaginatorIntl();
    // page index 1, size 10, total 13 -> items 11–13 de 13
    expect(intl.getRangeLabel(1, 10, 13)).toBe('11 – 13 de 13');
  });

  it('formats the first page range', () => {
    const intl = spanishPaginatorIntl();
    expect(intl.getRangeLabel(0, 10, 13)).toBe('1 – 10 de 13');
  });

  it('handles an empty total', () => {
    const intl = spanishPaginatorIntl();
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 de 0');
  });
});
