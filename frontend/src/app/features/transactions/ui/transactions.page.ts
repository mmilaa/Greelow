import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
  ElementRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { MatPaginatorModule, MatPaginatorIntl, type PageEvent } from '@angular/material/paginator';
import { AccountsStore } from '../../../shared/application/accounts.store';
import { TransactionsStore } from '../application/transactions.store';
import { CategoryStore } from '../application/category.store';
import {
  parseFilter,
  writeFilter,
  type TransactionFilter,
  type FilterRefs,
} from '../domain/transaction-filter';
import { totalPages, toApiPage, toUiPageIndex } from '../../../shared/domain/page';
import {
  TransactionsFiltersComponent,
  type AccountOption,
  type FilterPatch,
} from './transactions-filters.component';
import { TransactionRowComponent } from '../../../shared/ui/transaction-row.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel.component';
import { spanishPaginatorIntl } from './paginator-intl.es';

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    TransactionsStore,
    { provide: MatPaginatorIntl, useFactory: spanishPaginatorIntl },
  ],
  imports: [
    MatPaginatorModule,
    TransactionsFiltersComponent,
    TransactionRowComponent,
    StatePanelComponent,
  ],
  templateUrl: './transactions.page.html',
  styleUrl: './transactions.page.scss',
})
export class TransactionsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly accountsStore = inject(AccountsStore);
  private readonly categoryStore = inject(CategoryStore);
  private readonly store = inject(TransactionsStore);

  private readonly firstControl =
    viewChild<ElementRef<HTMLElement>>('filtersRegion');

  /** Raw query params as a signal, updated on every navigation. */
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Reference lists: null means "not loaded yet" (defer validation). */
  private readonly refs = computed<FilterRefs>(() => {
    const accountsState = this.accountsStore.state();
    const accounts =
      accountsState.status === 'ready'
        ? accountsState.rows.map((r) => r.account.id)
        : null;
    return { accounts, categories: this.categoryStore.categories() };
  });

  /** The parsed, normalized filter plus the list of ignored params. */
  private readonly parsed = computed(() =>
    parseFilter(this.queryParams(), this.refs()),
  );

  readonly filter = computed(() => this.parsed().filter);
  readonly ignored = computed(() => this.parsed().ignored);

  readonly listState = this.store.state;
  readonly resultCount = this.store.resultCount;

  /** Account options for the selector. */
  readonly accountOptions = computed<AccountOption[]>(() => {
    const s = this.accountsStore.state();
    return s.status === 'ready'
      ? s.rows.map((r) => ({ id: r.account.id, name: r.account.name, currency: r.account.currency }))
      : [];
  });

  readonly accountsLoading = computed(() => this.accountsStore.state().status === 'loading');

  readonly categories = computed(() => this.categoryStore.categories() ?? []);
  readonly categoriesDisabled = computed(() => this.categoryStore.failed());

  /** Map of account id -> name, for the per-row account label in "all accounts". */
  private readonly accountNames = computed<Map<string, string>>(() => {
    const s = this.accountsStore.state();
    const map = new Map<string, string>();
    if (s.status === 'ready') {
      for (const r of s.rows) map.set(r.account.id, r.account.name);
    }
    return map;
  });

  /** True when no single account is selected (show the account label per row). */
  readonly showAccountColumn = computed(() => this.filter().account === null);

  /** 0-based page index for mat-paginator. */
  readonly pageIndex = computed(() => toUiPageIndex(this.filter().page));

  readonly pageSizes = [10, 25, 50];

  constructor() {
    this.title.setTitle('Movimientos');

    // Fire the first query synchronously with the URL filter as-is, BEFORE the
    // reference lists load. This is what sends e.g. ?account=acc-9999 to the API
    // immediately; if the account turns out not to exist once the list loads, it
    // is dropped and the filter effect fires one more query without it.
    void this.store.load(untracked(() => this.filter()));

    // Load reference data once; the transactions query does NOT wait for it.
    void this.accountsStore.ensureLoaded();
    void this.categoryStore.loadOnce();

    // Run the query whenever the filter changes. The effect depends ONLY on the
    // filter; the load runs in untracked so the store's own signals do not
    // retrigger it (same guard as the account detail page). The first run is
    // deduped against the synchronous load above when the filter is unchanged.
    effect(() => {
      const filter = this.filter();
      untracked(() => void this.store.load(filter));
    });

    // Drop invalid params from the URL as soon as they are detected. Uses the
    // normalized filter, which still keeps account/category that are pending
    // validation, so those are never stripped prematurely.
    effect(() => {
      const ignored = this.ignored();
      const filter = this.filter();
      untracked(() => {
        if (ignored.length > 0) {
          this.replaceWith(filter);
        }
      });
    });

    // Correct the URL after a load settles: out-of-range page -> last page.
    effect(() => {
      const state = this.listState();
      untracked(() => this.correctUrl(state));
    });
  }

  /** The account label for a row, or null when a single account is selected. */
  accountLabel(accountId: string): { name: string | null; id: string } | null {
    if (!this.showAccountColumn()) return null;
    return { name: this.accountNames().get(accountId) ?? null, id: accountId };
  }

  onPage(event: PageEvent): void {
    const nextPage = toApiPage(event.pageIndex);
    const patch: Partial<TransactionFilter> =
      event.pageSize !== this.filter().pageSize
        ? // Changing the page size resets to page 1.
          { pageSize: event.pageSize as TransactionFilter['pageSize'], page: 1 }
        : { page: nextPage };
    this.navigate(patch, false);
  }

  onFilterChange(patch: FilterPatch): void {
    // Any content filter or page-size change resets to page 1.
    this.navigate({ ...patch, page: 1 }, false);
  }

  onSearchChange(search: string): void {
    // Build on the CURRENT filter so a concurrent filter change is preserved.
    this.navigate({ search, page: 1 }, true);
  }

  onClear(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    queueMicrotask(() => this.firstControl()?.nativeElement.querySelector<HTMLElement>(
      'mat-select, input',
    )?.focus());
  }

  onRefresh(): void {
    void this.store.load(this.filter(), true);
  }

  retry(): void {
    void this.store.load(this.filter(), true);
  }

  /** Writes the next filter to the URL; replaceUrl skips a history entry. */
  private navigate(patch: Partial<TransactionFilter>, replaceUrl: boolean): void {
    const next: TransactionFilter = { ...this.filter(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: writeFilter(next),
      replaceUrl,
    });
  }

  private correctUrl(state: ReturnType<TransactionsStore['state']>): void {
    if (state.status !== 'ready' && state.status !== 'empty') return;
    const pages = totalPages(state.total, state.pageSize);
    if (state.total > 0 && pages > 0 && this.filter().page > pages) {
      // Out of range (e.g. ?page=99 with 13 results): jump to the last page
      // without adding history. An out-of-range page comes back as an empty
      // list with total > 0, so this also covers the empty state.
      this.navigate({ page: pages }, true);
    }
  }

  /** Replaces the URL with the clean serialization of a filter (no history). */
  private replaceWith(filter: TransactionFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: writeFilter(filter),
      replaceUrl: true,
    });
  }
}
