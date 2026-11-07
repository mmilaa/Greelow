import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type TransactionFilter, PAGE_SIZES } from '../domain/transaction-filter';
import { categoryLabel } from '../../../shared/ui/transaction-labels';

/** One option in the account selector. */
export interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

/** A single-field change to the filter (everything except search). */
export type FilterPatch = Partial<
  Pick<TransactionFilter, 'account' | 'type' | 'status' | 'category' | 'pageSize'>
>;

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The filters bar. Presentational: it renders the current filter and emits
 * changes. Non-search changes emit `filterChange` (the page navigates with
 * history). Search is debounced 300 ms and emits `searchChange` (the page uses
 * replaceUrl). No business logic here.
 */
@Component({
  selector: 'app-transactions-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './transactions-filters.component.html',
  styleUrl: './transactions-filters.component.scss',
})
export class TransactionsFiltersComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly filter = input.required<TransactionFilter>();
  readonly accounts = input.required<AccountOption[]>();
  readonly accountsLoading = input(false);
  readonly categories = input.required<string[]>();
  /** True when the category list could not be loaded (select disabled + notice). */
  readonly categoriesDisabled = input(false);
  readonly loading = input(false);

  readonly filterChange = output<FilterPatch>();
  readonly searchChange = output<string>();
  readonly clear = output<void>();
  readonly refresh = output<void>();

  readonly pageSizes = PAGE_SIZES;
  readonly categoryLabelOf = categoryLabel;

  /** Local search box, debounced; the URL/store stays the source of truth. */
  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchInput = new Subject<string>();

  constructor() {
    // Keep the search box in sync with the filter (e.g. after Back/clear),
    // without triggering a debounced emit.
    effect(() => {
      const incoming = this.filter().search;
      if (this.searchControl.value !== incoming) {
        this.searchControl.setValue(incoming, { emitEvent: false });
      }
    });

    // Debounce typing; takeUntilDestroyed cancels the pending timer on destroy
    // so leaving the screen never emits (which would navigate back here).
    this.searchInput
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchChange.emit(value.trim()));
  }

  onSearchInput(value: string): void {
    this.searchInput.next(value);
  }

  onAccountChange(value: string): void {
    this.filterChange.emit({ account: value === '' ? null : value });
  }

  onTypeChange(value: string): void {
    this.filterChange.emit({ type: value === '' ? null : (value as TransactionFilter['type']) });
  }

  onStatusChange(value: string): void {
    this.filterChange.emit({
      status: value === '' ? null : (value as TransactionFilter['status']),
    });
  }

  onCategoryChange(value: string): void {
    this.filterChange.emit({ category: value === '' ? null : value });
  }

  onPageSizeChange(value: TransactionFilter['pageSize']): void {
    this.filterChange.emit({ pageSize: value });
  }

  onClear(): void {
    this.clear.emit();
  }

  onRefresh(): void {
    this.refresh.emit();
  }
}
