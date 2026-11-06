/**
 * A page of results. `totalPages` is derived in the domain (the API only sends
 * page, pageSize and total).
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Number of pages for a total and page size. `pageSize <= 0` yields 0. */
export function totalPages(total: number, pageSize: number): number {
  return pageSize <= 0 ? 0 : Math.ceil(total / pageSize);
}
