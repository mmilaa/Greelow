import { describe, it, expect } from 'vitest';
import { totalPages, toApiPage, toUiPageIndex } from './page';

describe('totalPages', () => {
  it('is 0 when total is 0', () => {
    expect(totalPages(0, 10)).toBe(0);
  });

  it('is total/pageSize when total is an exact multiple', () => {
    expect(totalPages(20, 10)).toBe(2);
  });

  it('rounds up when there is a remainder', () => {
    expect(totalPages(13, 5)).toBe(3);
  });

  it('is 1 when total is smaller than pageSize', () => {
    expect(totalPages(3, 10)).toBe(1);
  });

  it('is 0 when pageSize is 0 or negative (guard against division by zero)', () => {
    expect(totalPages(13, 0)).toBe(0);
    expect(totalPages(13, -5)).toBe(0);
  });
});

describe('page number conversion (UI 0-based <-> API 1-based)', () => {
  it('toApiPage adds one to the paginator index', () => {
    expect(toApiPage(0)).toBe(1);
    expect(toApiPage(4)).toBe(5);
  });

  it('toUiPageIndex subtracts one from the API page', () => {
    expect(toUiPageIndex(1)).toBe(0);
    expect(toUiPageIndex(5)).toBe(4);
  });

  it('round-trips', () => {
    expect(toUiPageIndex(toApiPage(3))).toBe(3);
    expect(toApiPage(toUiPageIndex(7))).toBe(7);
  });
});
