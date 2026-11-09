import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ExpensesStore } from '../application/expenses.store';
import {
  summarizeExpenses,
  monthsWithData,
  currenciesWithData,
  type MonthKey,
  type Period,
} from '../domain/summarize-expenses';
import { type Currency } from '../../../shared/domain/currency';
import { categoryLabel } from '../../../shared/ui/transaction-labels';
import { MoneyAmountComponent } from '../../../shared/ui/money-amount.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel.component';
import { CategoryListComponent } from './category-list.component';

/** A period option for the selector: "Todo el historial" or a month. */
interface PeriodOption {
  /** Serialized value for the select: 'all' or a "YYYY-MM" key. */
  value: string;
  label: string;
  period: Period;
}

/**
 * Expenses screen: a by-category summary of completed expenses, for one currency
 * and one period. The data is read once (store); changing the currency or the
 * period only recomputes the summary in the domain, it never re-reads.
 *
 * The component holds no business rules: amounts, grouping, months and
 * currencies all come from the domain. It only turns month keys into Spanish
 * labels and wires the selectors.
 */
@Component({
  selector: 'app-expenses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExpensesStore],
  imports: [
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MoneyAmountComponent,
    StatePanelComponent,
    CategoryListComponent,
  ],
  templateUrl: './expenses.page.html',
  styleUrl: './expenses.page.scss',
})
export class ExpensesPage implements OnInit {
  private readonly store = inject(ExpensesStore);

  /** The browser's time zone: months are placed in the local zone, not UTC. */
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  readonly state = this.store.state;
  readonly refreshing = this.store.refreshing;

  /** Selected currency ('' until the first ready load picks one). */
  private readonly selectedCurrencySig = signal<Currency | null>(null);
  /** Selected period value: 'all' or a "YYYY-MM" key. */
  private readonly selectedPeriodSig = signal<string>('all');

  /** The currencies that appear in the loaded expenses. */
  readonly currencies = computed<Currency[]>(() =>
    currenciesWithData(this.store.transactions()),
  );

  /** The effective selected currency: the choice, or the first available. */
  readonly currency = computed<Currency | null>(() => {
    const options = this.currencies();
    const chosen = this.selectedCurrencySig();
    if (chosen && options.includes(chosen)) {
      return chosen;
    }
    return options[0] ?? null;
  });

  /** Period options for the current currency: "Todo el historial" + its months. */
  readonly periodOptions = computed<PeriodOption[]>(() => {
    const currency = this.currency();
    const all: PeriodOption = {
      value: 'all',
      label: 'Todo el historial',
      period: { kind: 'all' },
    };
    if (!currency) {
      return [all];
    }
    const months = monthsWithData(this.store.transactions(), currency, this.timeZone).map(
      (month): PeriodOption => ({
        value: month,
        label: this.monthLabel(month),
        period: { kind: 'month', month },
      }),
    );
    return [all, ...months];
  });

  /** The effective period: the choice if still valid, else "Todo el historial". */
  readonly period = computed<Period>(() => {
    const value = this.selectedPeriodSig();
    const match = this.periodOptions().find((o) => o.value === value);
    return match?.period ?? { kind: 'all' };
  });

  /** The period value actually in effect (keeps the select in sync). */
  readonly periodValue = computed<string>(() => {
    const value = this.selectedPeriodSig();
    return this.periodOptions().some((o) => o.value === value) ? value : 'all';
  });

  /** The summary for the current currency and period, or null when no currency. */
  readonly summary = computed(() => {
    const currency = this.currency();
    if (!currency) {
      return null;
    }
    return summarizeExpenses(this.store.transactions(), {
      currency,
      period: this.period(),
      timeZone: this.timeZone,
      labelOf: categoryLabel,
    });
  });

  /** True when the user has no completed expenses at all (vs. empty period). */
  readonly noExpensesAtAll = computed(
    () => this.state().status === 'ready' && this.currencies().length === 0,
  );

  /** True when there are expenses, but none in the chosen period. */
  readonly emptyPeriod = computed(() => {
    const summary = this.summary();
    return summary !== null && summary.categories.length === 0;
  });

  /** The accessible caption / live label, e.g. "Gastos por categoría, ARS, octubre de 2026". */
  readonly caption = computed(() => {
    const currency = this.currency();
    if (!currency) {
      return 'Gastos por categoría';
    }
    return `Gastos por categoría, ${currency}, ${this.periodLabel()}`;
  });

  /** The live-region announcement for the current result. */
  readonly announcement = computed(() => {
    const summary = this.summary();
    const currency = this.currency();
    if (!summary || !currency) {
      return '';
    }
    const amount = this.formatForSpeech(summary);
    const n = summary.categories.length;
    if (n === 0) {
      return `${currency}, ${this.periodLabel()}: sin gastos en este período`;
    }
    const noun = n === 1 ? 'categoría' : 'categorías';
    return `${currency}, ${this.periodLabel()}: ${amount} en ${n} ${noun}`;
  });

  ngOnInit(): void {
    void this.store.load();
  }

  onCurrencyChange(currency: Currency): void {
    this.selectedCurrencySig.set(currency);
    // The chosen period may not exist for the new currency; reset to "all" so
    // the view never shows a period that has no data for this currency.
    this.selectedPeriodSig.set('all');
  }

  onPeriodChange(value: string): void {
    this.selectedPeriodSig.set(value);
  }

  refresh(): void {
    // Material's disabledInteractive does NOT cancel the click on a <button>,
    // so guard against a second refresh while one is already in flight.
    if (this.refreshing()) {
      return;
    }
    void this.store.refresh();
  }

  retry(): void {
    void this.store.load();
  }

  /** Spanish label for the current period (for captions and announcements). */
  private periodLabel(): string {
    const period = this.period();
    return period.kind === 'all' ? 'todo el historial' : this.monthLabel(period.month);
  }

  /** "YYYY-MM" -> "octubre de 2026" (es-AR). */
  private monthLabel(month: MonthKey): string {
    const [year, mo] = month.split('-').map(Number);
    // Noon UTC avoids any day rollover; only year and month are formatted.
    const date = new Date(Date.UTC(year, mo - 1, 1, 12));
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(date);
  }

  /** Amount spoken as a plain es-AR number with the currency code, no symbol tricks. */
  private formatForSpeech(summary: NonNullable<ReturnType<ExpensesPage['summary']>>): string {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(summary.total.toDecimal());
  }
}
