import {
  type TransactionType,
  type TransactionStatus,
} from '../../../shared/domain/transaction';
import { type TransactionQuery } from '../../../shared/application/transaction.port';

/**
 * The transactions list filter. Pure domain: no `@angular/*`, no Router. The UI
 * reads it from the URL and writes it back; the store turns it into a query.
 */
export interface TransactionFilter {
  /** Account id, or null for "all accounts". */
  account: string | null;
  type: TransactionType | null;
  status: TransactionStatus | null;
  category: string | null;
  /** Free-text search over the description. Empty string means "no filter". */
  search: string;
  /** 1-based page number (>= 1). */
  page: number;
  pageSize: PageSize;
}

export type PageSize = 10 | 25 | 50;

export const PAGE_SIZES: readonly PageSize[] = [10, 25, 50];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

const TYPES: readonly TransactionType[] = ['income', 'expense', 'transfer'];
const STATUSES: readonly TransactionStatus[] = ['pending', 'completed', 'failed'];

/** The filter with every field at its default (an empty, first-page listing). */
export const DEFAULT_FILTER: TransactionFilter = {
  account: null,
  type: null,
  status: null,
  category: null,
  search: '',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

/**
 * Reference lists used to validate `account` and `category`. `null` means "not
 * loaded yet": the value is kept as-is and NOT reported as ignored, because we
 * cannot yet know whether it is valid. A loaded list (even empty) does validate.
 */
export interface FilterRefs {
  accounts: readonly string[] | null;
  categories: readonly string[] | null;
}

/** A read-only view of URL params: `get(name)` returns the value or null. */
export interface ReadonlyParams {
  get(name: string): string | null;
}

function isType(value: string): value is TransactionType {
  return (TYPES as readonly string[]).includes(value);
}

function isStatus(value: string): value is TransactionStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}

/**
 * Reads the filter from URL params and normalizes it. Returns the normalized
 * filter plus the list of param names that were present but invalid and thus
 * ignored (so the UI can show one short, non-blocking notice).
 *
 * Validation rules:
 * - `type`/`status`: must be in their enum, else ignored.
 * - `pageSize`: must be one of {10,25,50}, else default 10 and ignored.
 * - `page`: integer >= 1, else 1 (a bad page is silently clamped, not reported).
 * - `category`: must be in the categories list; `account`: must be in the
 *   accounts list. If the corresponding list is null (not loaded), the value is
 *   kept and not reported — it will be re-validated once the list loads.
 */
export function parseFilter(
  params: ReadonlyParams,
  refs: FilterRefs,
): { filter: TransactionFilter; ignored: string[] } {
  const ignored: string[] = [];

  // type
  let type: TransactionType | null = null;
  const rawType = params.get('type');
  if (rawType !== null) {
    if (isType(rawType)) {
      type = rawType;
    } else {
      ignored.push('type');
    }
  }

  // status
  let status: TransactionStatus | null = null;
  const rawStatus = params.get('status');
  if (rawStatus !== null) {
    if (isStatus(rawStatus)) {
      status = rawStatus;
    } else {
      ignored.push('status');
    }
  }

  // category: validated against the list only when it is loaded (non-null).
  let category: string | null = null;
  const rawCategory = params.get('category');
  if (rawCategory !== null && rawCategory !== '') {
    if (refs.categories === null || refs.categories.includes(rawCategory)) {
      category = rawCategory;
    } else {
      ignored.push('category');
    }
  }

  // account: same deferred-validation rule as category.
  let account: string | null = null;
  const rawAccount = params.get('account');
  if (rawAccount !== null && rawAccount !== '') {
    if (refs.accounts === null || refs.accounts.includes(rawAccount)) {
      account = rawAccount;
    } else {
      ignored.push('account');
    }
  }

  // search: trimmed; empty means no filter.
  const search = (params.get('search') ?? '').trim();

  // pageSize: one of the allowed sizes, else default + ignored.
  let pageSize: PageSize = DEFAULT_PAGE_SIZE;
  const rawPageSize = params.get('pageSize');
  if (rawPageSize !== null) {
    const n = Number(rawPageSize);
    if (Number.isInteger(n) && isPageSize(n)) {
      pageSize = n;
    } else {
      ignored.push('pageSize');
    }
  }

  // page: integer >= 1, else 1 (clamped silently).
  let page = 1;
  const rawPage = params.get('page');
  if (rawPage !== null) {
    const n = Number(rawPage);
    if (Number.isInteger(n) && n >= 1) {
      page = n;
    }
  }

  return { filter: { account, type, status, category, search, page, pageSize }, ignored };
}

/**
 * Serializes the filter to URL params, omitting any field that is at its
 * default (so a clean listing is just `/transactions`). Returns a plain record
 * suitable for the Router's queryParams.
 */
export function writeFilter(filter: TransactionFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.account !== null) params['account'] = filter.account;
  if (filter.type !== null) params['type'] = filter.type;
  if (filter.status !== null) params['status'] = filter.status;
  if (filter.category !== null) params['category'] = filter.category;
  if (filter.search !== '') params['search'] = filter.search;
  if (filter.page !== 1) params['page'] = String(filter.page);
  if (filter.pageSize !== DEFAULT_PAGE_SIZE) params['pageSize'] = String(filter.pageSize);
  return params;
}

/** Whether any content filter (not pagination) is active. Drives the empty copy. */
export function hasActiveFilters(filter: TransactionFilter): boolean {
  return (
    filter.account !== null ||
    filter.type !== null ||
    filter.status !== null ||
    filter.category !== null ||
    filter.search !== ''
  );
}

/**
 * Turns the filter into the API query, sending only the active fields (and the
 * trimmed search). Page and pageSize always go.
 */
export function filterToQuery(filter: TransactionFilter): TransactionQuery {
  const query: TransactionQuery = { page: filter.page, pageSize: filter.pageSize };
  if (filter.account !== null) query.accountId = filter.account;
  if (filter.type !== null) query.type = filter.type;
  if (filter.status !== null) query.status = filter.status;
  if (filter.category !== null) query.category = filter.category;
  const search = filter.search.trim();
  if (search !== '') query.search = search;
  return query;
}
