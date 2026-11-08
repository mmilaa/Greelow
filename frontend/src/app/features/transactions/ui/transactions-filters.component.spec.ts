import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransactionsFiltersComponent, type FilterPatch } from './transactions-filters.component';
import { DEFAULT_FILTER, type TransactionFilter } from '../domain/transaction-filter';

function render(filter: TransactionFilter = DEFAULT_FILTER) {
  const fixture = TestBed.createComponent(TransactionsFiltersComponent);
  fixture.componentRef.setInput('filter', filter);
  fixture.componentRef.setInput('accounts', [
    { id: 'acc-1', name: 'Cuenta Pesos', currency: 'ARS' },
  ]);
  fixture.componentRef.setInput('categories', ['groceries', 'rent']);
  fixture.detectChanges();
  return fixture;
}

describe('TransactionsFiltersComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('emits a filter patch when the type changes (no debounce)', () => {
    const fixture = render();
    const patches: FilterPatch[] = [];
    fixture.componentInstance.filterChange.subscribe((p) => patches.push(p));
    fixture.componentInstance.onTypeChange('expense');
    expect(patches).toEqual([{ type: 'expense' }]);
  });

  it('maps the empty option back to null', () => {
    const fixture = render({ ...DEFAULT_FILTER, type: 'expense' });
    const patches: FilterPatch[] = [];
    fixture.componentInstance.filterChange.subscribe((p) => patches.push(p));
    fixture.componentInstance.onTypeChange('');
    expect(patches).toEqual([{ type: null }]);
  });

  it('emits clear and refresh', () => {
    const fixture = render();
    let cleared = false;
    let refreshed = false;
    fixture.componentInstance.clear.subscribe(() => (cleared = true));
    fixture.componentInstance.refresh.subscribe(() => (refreshed = true));
    fixture.componentInstance.onClear();
    fixture.componentInstance.onRefresh();
    expect(cleared).toBe(true);
    expect(refreshed).toBe(true);
  });

  it('does not emit refresh while loading (disabledInteractive click)', () => {
    const fixture = render();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    let refreshed = false;
    fixture.componentInstance.refresh.subscribe(() => (refreshed = true));
    fixture.componentInstance.onRefresh();
    expect(refreshed).toBe(false);
  });

  it('keeps the search box in sync with the filter input (Back restores the text)', () => {
    const fixture = render({ ...DEFAULT_FILTER, search: 'super' });
    expect(fixture.componentInstance.searchControl.value).toBe('super');
    // Navigating back to a filter with a different search updates the box.
    fixture.componentRef.setInput('filter', { ...DEFAULT_FILTER, search: 'alquiler' });
    fixture.detectChanges();
    expect(fixture.componentInstance.searchControl.value).toBe('alquiler');
  });

  describe('search debounce (fake timers)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('emits once after 300 ms of silence, trimmed', () => {
      const fixture = render();
      const emitted: string[] = [];
      fixture.componentInstance.searchChange.subscribe((s) => emitted.push(s));

      fixture.componentInstance.onSearchInput('s');
      fixture.componentInstance.onSearchInput('su');
      fixture.componentInstance.onSearchInput('  super ');
      vi.advanceTimersByTime(299);
      expect(emitted).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(emitted).toEqual(['super']);
    });

    it('does not emit when the component is destroyed before the window elapses', () => {
      const fixture = render();
      const emitted: string[] = [];
      fixture.componentInstance.searchChange.subscribe((s) => emitted.push(s));

      fixture.componentInstance.onSearchInput('super');
      vi.advanceTimersByTime(100);
      fixture.destroy(); // leaving the screen
      vi.advanceTimersByTime(500);
      expect(emitted).toEqual([]);
    });
  });
});
