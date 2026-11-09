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
import { AccountsStore } from '../../../shared/application/accounts.store';
import {
  summarizeExpenses,
  monthsWithData,
  currenciesWithData,
  accountsWithData,
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

/** An account option for the selector: "Todas las cuentas" or a single account. */
interface AccountOption {
  /** Serialized value for the select: 'all' or the account id. */
  value: string;
  label: string;
  /** The account id, or null for "Todas las cuentas". */
  accountId: string | null;
  /** The account's currency, or null for "all". */
  currency: Currency | null;
}

/** Sentinel value for "all accounts" in the account selector. */
const ALL_ACCOUNTS = 'all';

/**
 * Expenses screen: a by-category summary of completed expenses, for one account
 * (or all), one currency and one period. The data is read once (store); changing
 * the account, currency or period only recomputes the summary in the domain, it
 * never re-reads.
 *
 * An account has a single currency, so when a specific account is chosen the
 * currency is implied by it (and its selector is hidden); with "all accounts"
 * the currency selector decides which currency to summarize. Either way, money
 * of different currencies is never summed.
 *
 * The component holds no business rules: amounts, grouping, months, currencies
 * and accounts all come from the domain. It only turns keys into Spanish labels
 * and wires the selectors.
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
  // Used ONLY to resolve account names for the selector label. The list of
  // accounts shown still comes from the expenses themselves (accountsWithData),
  // and the summary never re-reads; names load once in parallel.
  private readonly accountsStore = inject(AccountsStore);

  /** The browser's time zone: months are placed in the local zone, not UTC. */
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /** Map account id -> name from AccountsStore, for the selector label. */
  private readonly accountNames = computed<Map<string, string>>(() => {
    const s = this.accountsStore.state();
    const map = new Map<string, string>();
    if (s.status === 'ready') {
      for (const r of s.rows) map.set(r.account.id, r.account.name);
    }
    return map;
  });

  readonly state = this.store.state;
  readonly refreshing = this.store.refreshing;

  /** Selected account value: 'all' or an account id. */
  private readonly selectedAccountSig = signal<string>(ALL_ACCOUNTS);
  /** Selected currency (only used with "all accounts"; null until picked). */
  private readonly selectedCurrencySig = signal<Currency | null>(null);
  /** Selected period value: 'all' or a "YYYY-MM" key. */
  private readonly selectedPeriodSig = signal<string>('all');

  /** Account options: "Todas las cuentas" + the accounts that appear in expenses. */
  readonly accountOptions = computed<AccountOption[]>(() => {
    const all: AccountOption = {
      value: ALL_ACCOUNTS,
      label: 'Todas las cuentas',
      accountId: null,
      currency: null,
    };
    const names = this.accountNames();
    const accounts = accountsWithData(this.store.transactions()).map(
      (a): AccountOption => {
        const name = names.get(a.accountId);
        // "Nombre - id (moneda)" when the name is known; "id (moneda)" until it
        // loads or if the account is not in the list, so the label never breaks.
        const label = name
          ? `${name} - ${a.accountId} (${a.currency})`
          : `${a.accountId} (${a.currency})`;
        return { value: a.accountId, label, accountId: a.accountId, currency: a.currency };
      },
    );
    return [all, ...accounts];
  });

  /** The effective account value (keeps the select in sync if the choice vanished). */
  readonly accountValue = computed<string>(() => {
    const value = this.selectedAccountSig();
    return this.accountOptions().some((o) => o.value === value) ? value : ALL_ACCOUNTS;
  });

  /** The chosen account option (null accountId for "all accounts"). */
  private readonly selectedAccount = computed<AccountOption>(
    () =>
      this.accountOptions().find((o) => o.value === this.accountValue()) ??
      this.accountOptions()[0],
  );

  /** The account id to filter by, or null for "all accounts". */
  readonly accountId = computed<string | null>(() => this.selectedAccount().accountId);

  /** True when a single account is chosen (hide the currency selector then). */
  readonly accountChosen = computed(() => this.accountId() !== null);

  /** The currencies that appear in the loaded expenses (for "all accounts"). */
  readonly currencies = computed<Currency[]>(() =>
    currenciesWithData(this.store.transactions()),
  );

  /**
   * The effective currency. With a single account it is that account's currency
   * (the selector is hidden). With "all accounts" it is the chosen currency, or
   * the first available.
   */
  readonly currency = computed<Currency | null>(() => {
    const account = this.selectedAccount();
    if (account.currency !== null) {
      return account.currency;
    }
    const options = this.currencies();
    const chosen = this.selectedCurrencySig();
    if (chosen && options.includes(chosen)) {
      return chosen;
    }
    return options[0] ?? null;
  });

  /** Period options for the current currency and account: "Todo el historial" + months. */
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
    const months = monthsWithData(
      this.store.transactions(),
      currency,
      this.timeZone,
      this.accountId(),
    ).map(
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
      accountId: this.accountId(),
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

  /**
   * The accessible caption / live scope, e.g.
   * "Gastos por categoría, ARS, octubre de 2026" or, with one account,
   * "Gastos por categoría, cuenta acc-1, ARS, octubre de 2026".
   */
  readonly caption = computed(() => {
    const currency = this.currency();
    if (!currency) {
      return 'Gastos por categoría';
    }
    return `Gastos por categoría, ${this.scopeLabel()}`;
  });

  /** The live-region announcement for the current result. */
  readonly announcement = computed(() => {
    const summary = this.summary();
    const currency = this.currency();
    if (!summary || !currency) {
      return '';
    }
    const n = summary.categories.length;
    if (n === 0) {
      return `${this.scopeLabel()}: sin gastos en este período`;
    }
    const amount = this.formatForSpeech(summary);
    const noun = n === 1 ? 'categoría' : 'categorías';
    return `${this.scopeLabel()}: ${amount} en ${n} ${noun}`;
  });

  ngOnInit(): void {
    void this.store.load();
    // Load account names once, in parallel. The expenses summary does not wait
    // for this: if names are unavailable the label falls back to "id (moneda)".
    void this.accountsStore.ensureLoaded();
  }

  onAccountChange(value: string): void {
    this.selectedAccountSig.set(value);
    // The chosen currency/period may not exist for the new account; reset the
    // period so the view never shows a period with no data for this scope.
    this.selectedPeriodSig.set('all');
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

  /**
   * The Spanish scope label: account (if one is chosen), currency and period.
   * E.g. "ARS, octubre de 2026" or "cuenta acc-1, ARS, todo el historial".
   */
  private scopeLabel(): string {
    const currency = this.currency();
    const accountId = this.accountId();
    const parts: string[] = [];
    if (accountId !== null) {
      parts.push(`cuenta ${accountId}`);
    }
    if (currency) {
      parts.push(currency);
    }
    parts.push(this.periodLabel());
    return parts.join(', ');
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
