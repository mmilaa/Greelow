import { describe, it, expect } from 'vitest';
import {
  parseFilter,
  writeFilter,
  filterToQuery,
  hasActiveFilters,
  DEFAULT_FILTER,
  type TransactionFilter,
  type FilterRefs,
  type ReadonlyParams,
} from './transaction-filter';

/** Builds a ReadonlyParams from a plain record. */
function params(record: Record<string, string>): ReadonlyParams {
  return { get: (name: string) => (name in record ? record[name] : null) };
}

const LOADED: FilterRefs = {
  accounts: ['acc-1', 'acc-2'],
  categories: ['groceries', 'rent', 'salary', 'transfer'],
};

const NOT_LOADED: FilterRefs = { accounts: null, categories: null };

describe('parseFilter', () => {
  it('with no params is all accounts, page 1, 10 per page, nothing ignored', () => {
    const { filter, ignored } = parseFilter(params({}), LOADED);
    expect(filter).toEqual(DEFAULT_FILTER);
    expect(ignored).toEqual([]);
  });

  it('reads every valid param', () => {
    const { filter, ignored } = parseFilter(
      params({
        account: 'acc-1',
        type: 'expense',
        status: 'pending',
        category: 'rent',
        search: 'super',
        page: '2',
        pageSize: '25',
      }),
      LOADED,
    );
    expect(filter).toEqual({
      account: 'acc-1',
      type: 'expense',
      status: 'pending',
      category: 'rent',
      search: 'super',
      page: 2,
      pageSize: 25,
    });
    expect(ignored).toEqual([]);
  });

  it('ignores an invalid type', () => {
    const { filter, ignored } = parseFilter(params({ type: 'foo' }), LOADED);
    expect(filter.type).toBeNull();
    expect(ignored).toContain('type');
  });

  it('ignores an invalid status', () => {
    const { filter, ignored } = parseFilter(params({ status: 'done' }), LOADED);
    expect(filter.status).toBeNull();
    expect(ignored).toContain('status');
  });

  it('ignores a non-integer page and falls back to 1 (not reported)', () => {
    const { filter, ignored } = parseFilter(params({ page: 'abc' }), LOADED);
    expect(filter.page).toBe(1);
    expect(ignored).not.toContain('page');
  });

  it('ignores page 0 and negatives, falling back to 1', () => {
    expect(parseFilter(params({ page: '0' }), LOADED).filter.page).toBe(1);
    expect(parseFilter(params({ page: '-3' }), LOADED).filter.page).toBe(1);
  });

  it('ignores a pageSize outside {10,25,50} and defaults to 10', () => {
    const { filter, ignored } = parseFilter(params({ pageSize: '100' }), LOADED);
    expect(filter.pageSize).toBe(10);
    expect(ignored).toContain('pageSize');
  });

  it('ignores an intermediate pageSize like 30', () => {
    const { filter, ignored } = parseFilter(params({ pageSize: '30' }), LOADED);
    expect(filter.pageSize).toBe(10);
    expect(ignored).toContain('pageSize');
  });

  it('ignores an account absent from the loaded list', () => {
    const { filter, ignored } = parseFilter(params({ account: 'acc-9999' }), LOADED);
    expect(filter.account).toBeNull();
    expect(ignored).toContain('account');
  });

  it('ignores a category absent from the loaded list', () => {
    const { filter, ignored } = parseFilter(params({ category: 'crypto' }), LOADED);
    expect(filter.category).toBeNull();
    expect(ignored).toContain('category');
  });

  it('keeps account and category when their lists are not loaded yet (no ignore)', () => {
    const { filter, ignored } = parseFilter(
      params({ account: 'acc-9999', category: 'crypto' }),
      NOT_LOADED,
    );
    expect(filter.account).toBe('acc-9999');
    expect(filter.category).toBe('crypto');
    expect(ignored).toEqual([]);
  });

  it('validates account/category independently of each other', () => {
    // accounts loaded (acc-1 ok), categories not loaded (crypto kept).
    const refs: FilterRefs = { accounts: ['acc-1'], categories: null };
    const { filter, ignored } = parseFilter(
      params({ account: 'acc-1', category: 'crypto' }),
      refs,
    );
    expect(filter.account).toBe('acc-1');
    expect(filter.category).toBe('crypto');
    expect(ignored).toEqual([]);
  });

  it('trims search and treats whitespace-only as empty', () => {
    expect(parseFilter(params({ search: '  super ' }), LOADED).filter.search).toBe('super');
    expect(parseFilter(params({ search: '   ' }), LOADED).filter.search).toBe('');
  });

  it('collects multiple invalid params together', () => {
    const { ignored } = parseFilter(params({ type: 'foo', pageSize: '99' }), LOADED);
    expect(ignored).toEqual(expect.arrayContaining(['type', 'pageSize']));
    expect(ignored).toHaveLength(2);
  });
});

describe('writeFilter', () => {
  it('omits every default (a clean filter serializes to {})', () => {
    expect(writeFilter(DEFAULT_FILTER)).toEqual({});
  });

  it('writes only the non-default fields', () => {
    const filter: TransactionFilter = {
      account: 'acc-1',
      type: 'expense',
      status: null,
      category: null,
      search: 'super',
      page: 2,
      pageSize: 25,
    };
    expect(writeFilter(filter)).toEqual({
      account: 'acc-1',
      type: 'expense',
      search: 'super',
      page: '2',
      pageSize: '25',
    });
  });

  it('round-trips through parseFilter', () => {
    const filter: TransactionFilter = {
      account: 'acc-1',
      type: 'transfer',
      status: 'completed',
      category: 'rent',
      search: 'alquiler',
      page: 3,
      pageSize: 50,
    };
    const { filter: parsed } = parseFilter(params(writeFilter(filter)), LOADED);
    expect(parsed).toEqual(filter);
  });
});

describe('filterToQuery', () => {
  it('sends only page and pageSize for the default filter', () => {
    expect(filterToQuery(DEFAULT_FILTER)).toEqual({ page: 1, pageSize: 10 });
  });

  it('maps active fields and trims the search', () => {
    const filter: TransactionFilter = {
      account: 'acc-1',
      type: 'expense',
      status: 'pending',
      category: 'rent',
      search: '  super ',
      page: 2,
      pageSize: 25,
    };
    expect(filterToQuery(filter)).toEqual({
      accountId: 'acc-1',
      type: 'expense',
      status: 'pending',
      category: 'rent',
      search: 'super',
      page: 2,
      pageSize: 25,
    });
  });

  it('omits an empty/whitespace search', () => {
    expect(filterToQuery({ ...DEFAULT_FILTER, search: '   ' })).toEqual({ page: 1, pageSize: 10 });
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default filter', () => {
    expect(hasActiveFilters(DEFAULT_FILTER)).toBe(false);
  });

  it('is false when only pagination differs', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTER, page: 3, pageSize: 50 })).toBe(false);
  });

  it('is true when any content filter is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTER, account: 'acc-1' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTER, type: 'expense' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTER, status: 'pending' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTER, category: 'rent' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTER, search: 'super' })).toBe(true);
  });
});
