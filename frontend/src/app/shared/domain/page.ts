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

/**
 * Page-number conversion between the UI paginator (0-based index) and the API
 * (1-based page). Kept here so the off-by-one lives in exactly one place.
 */

/** API page (1-based) from a mat-paginator page index (0-based). */
export function toApiPage(uiPageIndex: number): number {
  return uiPageIndex + 1;
}

/** mat-paginator page index (0-based) from an API page (1-based). */
export function toUiPageIndex(apiPage: number): number {
  return apiPage - 1;
}
